/**
 * Structured single-line logging (spec §5.1, task 05). Never log keys, hashes
 * or PII — callers pass account ids / prefixes / event ids only.
 */
type Level = "info" | "warn" | "error";

function emit(level: Level, scope: string, message: string, fields?: Record<string, unknown>): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    scope,
    message,
    ...fields,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function logInfo(scope: string, message: string, fields?: Record<string, unknown>): void {
  emit("info", scope, message, fields);
}

export function logWarn(scope: string, message: string, fields?: Record<string, unknown>): void {
  emit("warn", scope, message, fields);
}

export function logError(
  scope: string,
  message: string,
  err?: unknown,
  fields?: Record<string, unknown>,
): void {
  emit("error", scope, message, {
    error: err instanceof Error ? err.message : String(err ?? "unknown"),
    ...fields,
  });
}
