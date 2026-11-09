"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setAccountDefaultStyle } from "@/features/accounts/actions";
import {
  styleLabels,
  TRADE_STYLE_VALUES,
  type TradeStyleValue,
} from "@/lib/trade-style";

/**
 * Account-level trading style (owner request, 2026-11): picking a style
 * retags every auto-style trade on the account; "Auto" returns to §9
 * holding-time classification. Manual overrides on single trades win.
 */
export function AccountStyleDialog({
  accountId,
  displayName,
  current,
  onClose,
}: {
  accountId: string;
  displayName: string;
  current: TradeStyleValue | null;
  onClose: () => void;
}) {
  const [value, setValue] = useState<string>(current ?? "auto");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const defaultStyle = value === "auto" ? null : (value as TradeStyleValue);
    const result = await setAccountDefaultStyle({ accountId, defaultStyle });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      defaultStyle
        ? `Trading style set to ${styleLabels[defaultStyle]} for “${displayName}”.`
        : `“${displayName}” set to Auto — trades re-classified by holding time.`,
    );
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent aria-describedby="account-style-description">
        <DialogHeader>
          <DialogTitle>Trading style — {displayName}</DialogTitle>
          <DialogDescription id="account-style-description">
            Every auto-styled trade in this account gets the selected style — past and
            future. Manual overrides on single trades are kept, and it applies to this
            account only.
          </DialogDescription>
        </DialogHeader>
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger aria-label="Trading style">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto — classified by holding time (§9)</SelectItem>
            {TRADE_STYLE_VALUES.map((style) => (
              <SelectItem key={style} value={style}>
                {styleLabels[style]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
