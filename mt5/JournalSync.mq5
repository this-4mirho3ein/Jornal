//+------------------------------------------------------------------+
//| JournalSync.mq5 — Pushes MT5 trade events to the web journal     |
//| Spec: TRADING_JOURNAL_SPEC.md §6 (contract §4.2, §5 /api/ingest) |
//+------------------------------------------------------------------+
//| Compile in MetaEditor (Windows, or Mac via Wine/CrossOver): F7.  |
//| Install + testing + troubleshooting guide: mt5/README.md.        |
//|                                                                  |
//| Deviations from the spec §6 skeleton (all reviewed, none change  |
//| structure or behavior):                                          |
//|  1. §10 (add now): position payload carries tickValue/tickSize   |
//|     (SymbolInfoDouble) so the API computes exact risk_amount and |
//|     r_multiple. Omitted when the symbol cannot provide them      |
//|     (schema requires tickSize > 0 when present).                 |
//|  2. `orderId` is OMITTED when DEAL_ORDER = 0 (balance ops): the  |
//|     wire contract requires it positive when present, and zeroing |
//|     it would 422-drop every deposit/withdrawal as poison.        |
//|  3. Heartbeat eventIds use epoch seconds everywhere (the         |
//|     skeleton OnInit used a datetime string, OnTimer an epoch).   |
//|  4. position_modify eventIds include the server-second so an SL  |
//|     round-trip (A→B→A) can no longer collide with an earlier     |
//|     identical mod event and leave the stored SL stale.           |
//|  5. The queue file is opened with CP_UTF8 so broker comments in  |
//|     any language survive the write→read round-trip unchanged.    |
//|  6. StringToCharArray return count strips the trailing '\0'      |
//|     (same effect as ArraySize-1, uses the documented return).    |
//|                                                                  |
//| Attach to ONE chart only — one instance per account receives     |
//| events for ALL symbols (see mt5/README.md).                      |
//+------------------------------------------------------------------+
#property copyright "Trading Journal"
#property version   "1.01"
#property strict

// Zero-config defaults: leave the first two inputs EMPTY and the EA
// configures itself on attach --
//   URL -> MQL5/Files/journal_url.txt when present, else the local journal
//          (http://localhost:3000/api/ingest). Override for production.
//   Key -> MQL5/Files/journal_key.txt (one line: the ingest key from the
//          website's Accounts page). That file lives only in this terminal's
//          data folder -- NEVER commit or sync it (spec rule 6, no secrets
//          in the repo); filling InpApiKey here still works as an override.
input string InpApiUrl        = "";       // empty = journal_url.txt, else local journal
input string InpApiKey        = "";       // empty = journal_key.txt in MQL5/Files
input int    InpHeartbeatSec  = 60;       // heartbeat + queue flush period
input int    InpTimeoutMs     = 8000;     // WebRequest timeout
input int    InpBackfillDays  = 90;       // >0: send closed deals of last N days once at start
input bool   InpVerbose       = true;     // log every HTTP status + queue flush

const string QUEUE_FILE      = "journal_queue.jsonl"; // in MQL5/Files
const string KEY_FILE        = "journal_key.txt";     // in MQL5/Files - local only, never committed
const string URL_FILE        = "journal_url.txt";     // in MQL5/Files - optional URL override
const string DEFAULT_API_URL = "http://localhost:3000/api/ingest";

string       g_apiUrl        = "";
string       g_apiKey        = "";
datetime     g_lastHeartbeat = 0;
bool         g_flushing = false;

// First line of a UTF-8 text file in MQL5/Files ("" when missing) — used for
// the per-terminal key/url secrets so this source file stays repo-clean.
string ReadConfigLine(const string filename)
{
   if(!FileIsExist(filename)) return "";
   int h = FileOpen(filename, FILE_READ|FILE_TXT|FILE_ANSI, '\t', CP_UTF8);
   if(h == INVALID_HANDLE) return "";
   string line = FileReadString(h);
   FileClose(h);
   StringTrimLeft(line);
   StringTrimRight(line);
   if(StringLen(line) > 0 && StringGetCharacter(line, 0) == 0xFEFF)
      line = StringSubstr(line, 1);          // strip a BOM some editors add
   return line;
}

//------------------------------------------------------------------
int OnInit()
{
   g_apiKey = (StringLen(InpApiKey) >= 10) ? InpApiKey : ReadConfigLine(KEY_FILE);
   if(StringLen(g_apiKey) < 10)
   {
      Alert("JournalSync: no ingest key - put it in MQL5\\Files\\journal_key.txt or fill InpApiKey");
      return INIT_PARAMETERS_INCORRECT;
   }
   g_apiUrl = (StringLen(InpApiUrl) >= 8) ? InpApiUrl : ReadConfigLine(URL_FILE);
   if(StringLen(g_apiUrl) < 8) g_apiUrl = DEFAULT_API_URL;

   EventSetTimer(1);
   if(InpVerbose)
      Print("JournalSync: url=", g_apiUrl,
            " key=", StringSubstr(g_apiKey, 0, 8), "...",        // prefix only - never the full key
            " backfill=", (string)InpBackfillDays, "d");
   if(InpBackfillDays > 0) Backfill(InpBackfillDays);
   EnqueueEvent("hb:" + (string)((long)TimeGMT()), "heartbeat", "", "");
   return INIT_SUCCEEDED;
}
void OnDeinit(const int reason) { EventKillTimer(); }

//------------------------------------------------------------------
void OnTimer()
{
   FlushQueue();
   if(TimeGMT() - g_lastHeartbeat >= InpHeartbeatSec)
   {
      g_lastHeartbeat = TimeGMT();
      EnqueueEvent("hb:" + (string)((long)TimeGMT()), "heartbeat", "", "");
   }
}

//------------------------------------------------------------------
void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest &request,
                        const MqlTradeResult &result)
{
   // 1) A deal was added to history (open, close, balance op...)
   if(trans.type == TRADE_TRANSACTION_DEAL_ADD)
   {
      ulong dealId = trans.deal;
      if(!HistoryDealSelect(dealId)) { HistorySelect(TimeCurrent() - 86400*3, TimeCurrent() + 60); if(!HistoryDealSelect(dealId)) return; }
      SendDeal(dealId);
      return;
   }
   // 2) SL/TP modified on an open position
   if(trans.type == TRADE_TRANSACTION_POSITION && trans.position > 0)
   {
      if(PositionSelectByTicket(trans.position))
      {
         string posJson = BuildPositionJson(trans.position);
         string id = "mod:" + (string)trans.position
                   + ":" + (string)((long)TimeTradeServer())     // see header, deviation 4
                   + ":" + DoubleToString(PositionGetDouble(POSITION_SL), 5)
                   + ":" + DoubleToString(PositionGetDouble(POSITION_TP), 5);
         EnqueueEvent(id, "position_modify", posJson, "");
      }
   }
}

//------------------------------------------------------------------
void SendDeal(ulong dealId)
{
   long dtype = HistoryDealGetInteger(dealId, DEAL_TYPE);
   long entry = HistoryDealGetInteger(dealId, DEAL_ENTRY);

   // Non-trade operations: balance/credit/charge/correction/bonus...
   if(dtype != DEAL_TYPE_BUY && dtype != DEAL_TYPE_SELL)
   {
      EnqueueEvent("deal:" + (string)dealId, "cash_op", "", BuildDealJson(dealId));
      return;
   }
   ulong posId = (ulong)HistoryDealGetInteger(dealId, DEAL_POSITION_ID);
   string type = (entry == DEAL_ENTRY_IN) ? "deal_open" : "deal_close";

   string posJson;
   if(PositionSelectByTicket(posId)) posJson = BuildPositionJson(posId);
   else                              posJson = BuildClosedPositionJson(dealId, posId);

   EnqueueEvent("deal:" + (string)dealId, type, posJson, BuildDealJson(dealId));
}

//------------------------------------------------------------------
string BuildPositionJson(ulong posId)
{
   // requires PositionSelectByTicket(posId) to have succeeded
   long   ptype = PositionGetInteger(POSITION_TYPE);
   string sym   = PositionGetString(POSITION_SYMBOL);
   string s = "{";
   s += "\"positionId\":" + (string)posId;
   s += ",\"symbol\":\"" + JsonEsc(sym) + "\"";
   s += ",\"direction\":\"" + (ptype == POSITION_TYPE_BUY ? "buy" : "sell") + "\"";
   s += ",\"magic\":" + (string)PositionGetInteger(POSITION_MAGIC);
   s += ",\"comment\":\"" + JsonEsc(PositionGetString(POSITION_COMMENT)) + "\"";
   s += ",\"volume\":" + DoubleToString(PositionGetDouble(POSITION_VOLUME), 2);
   s += ",\"sl\":" + DoubleToString(PositionGetDouble(POSITION_SL), 5);
   s += ",\"tp\":" + DoubleToString(PositionGetDouble(POSITION_TP), 5);
   s += TickMetaJson(sym);      // §10 — enable exact risk_amount / r_multiple
   s += "}";
   return s;
}

// Position already (fully) closed: rebuild from the deal itself
string BuildClosedPositionJson(ulong dealId, ulong posId)
{
   long dtype = HistoryDealGetInteger(dealId, DEAL_TYPE);
   string sym = HistoryDealGetString(dealId, DEAL_SYMBOL);
   // closing deal direction is opposite of the position direction
   string dir = (dtype == DEAL_TYPE_SELL) ? "buy" : "sell";
   double sl = HistoryDealGetDouble(dealId, DEAL_SL);
   double tp = HistoryDealGetDouble(dealId, DEAL_TP);
   string s = "{";
   s += "\"positionId\":" + (string)posId;
   s += ",\"symbol\":\"" + JsonEsc(sym) + "\"";
   s += ",\"direction\":\"" + dir + "\"";
   s += ",\"magic\":" + (string)HistoryDealGetInteger(dealId, DEAL_MAGIC);
   s += ",\"comment\":\"" + JsonEsc(HistoryDealGetString(dealId, DEAL_COMMENT)) + "\"";
   s += ",\"volume\":0";        // fully closed — server treats 0 as valid (§4.1)
   s += ",\"sl\":" + DoubleToString(sl, 5);
   s += ",\"tp\":" + DoubleToString(tp, 5);
   s += TickMetaJson(sym);      // §10 — symbol stays resolvable after close
   s += "}";
   return s;
}

// §10 — appended to both position builders; "" when the symbol cannot
// provide them (the contract requires tickSize > 0 when the field exists,
// and a bad payload would be dropped as poison by the EA's own queue).
string TickMetaJson(const string symbol)
{
   double tickValue = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE);
   double tickSize  = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_SIZE);
   if(tickValue <= 0 || tickSize <= 0) return "";
   return ",\"tickValue\":" + DoubleToString(tickValue, 8)
        + ",\"tickSize\":" + DoubleToString(tickSize, 8);
}

string BuildDealJson(ulong dealId)
{
   long entry = HistoryDealGetInteger(dealId, DEAL_ENTRY);
   string e = "in";
   if(entry == DEAL_ENTRY_OUT) e = "out";
   else if(entry == DEAL_ENTRY_INOUT) e = "inout";
   else if(entry == DEAL_ENTRY_OUT_BY) e = "out_by";

   long reason = HistoryDealGetInteger(dealId, DEAL_REASON);
   string r = "other";
   if(reason == DEAL_REASON_SL) r = "sl";
   else if(reason == DEAL_REASON_TP) r = "tp";
   else if(reason == DEAL_REASON_SO) r = "so";
   else if(reason == DEAL_REASON_EXPERT) r = "expert";
   else if(reason == DEAL_REASON_CLIENT) r = "client";
   else if(reason == DEAL_REASON_MOBILE) r = "mobile";
   else if(reason == DEAL_REASON_WEB) r = "web";

   datetime tServer = (datetime)HistoryDealGetInteger(dealId, DEAL_TIME);
   long tUtc = (long)tServer - ServerOffsetSec();

   long orderId = HistoryDealGetInteger(dealId, DEAL_ORDER);
   string s = "{";
   s += "\"dealId\":" + (string)dealId;
   if(orderId > 0) s += ",\"orderId\":" + (string)orderId;   // omitted for balance ops (header, deviation 2)
   s += ",\"entry\":\"" + e + "\"";
   s += ",\"price\":" + DoubleToString(HistoryDealGetDouble(dealId, DEAL_PRICE), 5);
   s += ",\"volume\":" + DoubleToString(HistoryDealGetDouble(dealId, DEAL_VOLUME), 2);
   s += ",\"profit\":" + DoubleToString(HistoryDealGetDouble(dealId, DEAL_PROFIT), 2);
   s += ",\"commission\":" + DoubleToString(HistoryDealGetDouble(dealId, DEAL_COMMISSION), 2);
   s += ",\"swap\":" + DoubleToString(HistoryDealGetDouble(dealId, DEAL_SWAP), 2);
   s += ",\"fee\":" + DoubleToString(HistoryDealGetDouble(dealId, DEAL_FEE), 2);
   s += ",\"timeUtc\":" + (string)tUtc;
   s += ",\"reason\":\"" + r + "\"";
   s += ",\"dealType\":" + (string)HistoryDealGetInteger(dealId, DEAL_TYPE); // diagnostic; server strips unknown fields
   s += ",\"comment\":\"" + JsonEsc(HistoryDealGetString(dealId, DEAL_COMMENT)) + "\"";
   s += "}";
   return s;
}

string BuildAccountJson()
{
   string s = "{";
   s += "\"login\":" + (string)AccountInfoInteger(ACCOUNT_LOGIN);
   s += ",\"server\":\"" + JsonEsc(AccountInfoString(ACCOUNT_SERVER)) + "\"";
   s += ",\"company\":\"" + JsonEsc(AccountInfoString(ACCOUNT_COMPANY)) + "\"";
   s += ",\"currency\":\"" + JsonEsc(AccountInfoString(ACCOUNT_CURRENCY)) + "\"";
   s += ",\"leverage\":" + (string)AccountInfoInteger(ACCOUNT_LEVERAGE);
   s += ",\"balance\":" + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2);
   s += ",\"equity\":" + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2);
   s += ",\"margin\":" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN), 2);
   s += ",\"freeMargin\":" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN_FREE), 2);
   s += ",\"marginLevel\":" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN_LEVEL), 2);
   s += ",\"isDemo\":" + (AccountInfoInteger(ACCOUNT_TRADE_MODE) == ACCOUNT_TRADE_MODE_DEMO ? "true" : "false");
   s += "}";
   return s;
}

//------------------------------------------------------------------
// Queue: every event is written to disk first, then flushed in order.
void EnqueueEvent(string eventId, string type, string positionJson, string dealJson)
{
   string j = "{\"schemaVersion\":1";
   j += ",\"eventId\":\"" + JsonEsc(eventId) + "\"";
   j += ",\"type\":\"" + type + "\"";
   j += ",\"sentAtUtc\":" + (string)((long)TimeGMT());
   j += ",\"account\":" + BuildAccountJson();
   if(positionJson != "") j += ",\"position\":" + positionJson;
   if(dealJson != "")     j += ",\"deal\":" + dealJson;
   j += "}";

   int h = FileOpen(QUEUE_FILE, FILE_READ|FILE_WRITE|FILE_TXT|FILE_ANSI|FILE_SHARE_READ, '\t', CP_UTF8);
   if(h == INVALID_HANDLE) { Print("JournalSync: cannot open queue file ", GetLastError()); return; }
   FileSeek(h, 0, SEEK_END);
   FileWriteString(h, j + "\n");
   FileClose(h);
   FlushQueue();
}

void FlushQueue()
{
   if(g_flushing) return;
   g_flushing = true;

   if(!FileIsExist(QUEUE_FILE)) { g_flushing = false; return; }
   int h = FileOpen(QUEUE_FILE, FILE_READ|FILE_TXT|FILE_ANSI|FILE_SHARE_READ|FILE_SHARE_WRITE, '\t', CP_UTF8);
   if(h == INVALID_HANDLE) { g_flushing = false; return; }

   string lines[]; int n = 0;
   while(!FileIsEnding(h))
   {
      string line = FileReadString(h);
      if(StringLen(line) > 2) { ArrayResize(lines, n + 1); lines[n++] = line; }
   }
   FileClose(h);
   if(n == 0) { g_flushing = false; return; }

   int sent = 0;
   for(int i = 0; i < n; i++)
   {
      int code = Post(lines[i]);
      // 2xx -> done. 4xx (except 408/429) -> drop poison message. else retry later.
      if((code >= 200 && code < 300) || (code >= 400 && code < 500 && code != 408 && code != 429))
         sent++;
      else break;                      // keep order: stop at first failure
      if(sent >= 20) break;            // do not block the terminal too long
   }
   if(sent > 0)
   {
      int w = FileOpen(QUEUE_FILE, FILE_WRITE|FILE_TXT|FILE_ANSI, '\t', CP_UTF8);   // rewrite remaining
      if(w != INVALID_HANDLE)
      {
         for(int k = sent; k < n; k++) FileWriteString(w, lines[k] + "\n");
         FileClose(w);
      }
   }
   if(InpVerbose && sent > 0) Print("JournalSync: flushed ", sent, " event(s), ", n - sent, " queued");
   g_flushing = false;
}

int Post(const string json)
{
   char body[], res[]; string resHeaders;
   int count = StringToCharArray(json, body, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(body, count - 1);                        // strip trailing \0
   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + g_apiKey + "\r\n";
   ResetLastError();
   int code = WebRequest("POST", g_apiUrl, headers, InpTimeoutMs, body, res, resHeaders);
   if(code == -1)
   {
      Print("JournalSync: WebRequest error ", GetLastError(), " (is the URL whitelisted in Tools>Options>Expert Advisors?)");
      return -1;
   }
   if(InpVerbose) Print("JournalSync: HTTP ", code);
   return code;
}

//------------------------------------------------------------------
long ServerOffsetSec() { return (long)(TimeTradeServer() - TimeGMT()); }

string JsonEsc(string s)
{
   StringReplace(s, "\\", "\\\\");
   StringReplace(s, "\"", "\\\"");
   StringReplace(s, "\r", " ");
   StringReplace(s, "\n", " ");
   StringReplace(s, "\t", " ");
   return s;
}

void Backfill(int days)
{
   datetime from = TimeCurrent() - (datetime)(days * 86400);
   if(!HistorySelect(from, TimeCurrent())) return;
   int total = HistoryDealsTotal();
   if(InpVerbose) Print("JournalSync: backfilling ", total, " deals from the last ", days, " day(s)");
   for(int i = 0; i < total; i++)
   {
      ulong d = HistoryDealGetTicket(i);
      if(d > 0) SendDeal(d);
   }
}
