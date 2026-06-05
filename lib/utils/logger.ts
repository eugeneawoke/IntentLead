type Level = "debug" | "info" | "warn" | "error";

function log(level: Level, meta: Record<string, unknown>, msg: string) {
  const entry = JSON.stringify({ level, ts: new Date().toISOString(), msg, ...meta });
  if (level === "error" || level === "warn") {
    process.stderr.write(entry + "\n");
  } else {
    process.stdout.write(entry + "\n");
  }
}

export const logger = {
  debug: (meta: Record<string, unknown>, msg: string) => log("debug", meta, msg),
  info:  (meta: Record<string, unknown>, msg: string) => log("info",  meta, msg),
  warn:  (meta: Record<string, unknown>, msg: string) => log("warn",  meta, msg),
  error: (meta: Record<string, unknown>, msg: string) => log("error", meta, msg),
};
