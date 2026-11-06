/**
 * Env loader for code that runs outside Next.js (db scripts via tsx, the
 * Better Auth CLI). Next.js loads .env.local for the app automatically, but
 * bare `tsx` only gets "dotenv/config" — i.e. `.env`, which may not exist.
 *
 * Mirrors Next.js precedence: real shell env wins, then .env.local, then
 * .env (dotenv never overrides already-set variables, so load order decides).
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();
