import { db } from "./db";
export type RateResult = { ok: true } | { ok: false; retryAfter: number };
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateResult> {
  const now = Date.now();
  try {
    const row = (
      await db.execute({
        sql: `INSERT INTO rate_limits(key,count,reset_at) VALUES(?,1,?)
      ON CONFLICT(key) DO UPDATE SET
      count=CASE WHEN rate_limits.reset_at<=? THEN 1 ELSE rate_limits.count+1 END,
      reset_at=CASE WHEN rate_limits.reset_at<=? THEN excluded.reset_at ELSE rate_limits.reset_at END
      RETURNING count,reset_at`,
        args: [key, now + windowMs, now, now],
      })
    ).rows[0];
    return Number(row.count) <= limit
      ? { ok: true }
      : {
          ok: false,
          retryAfter: Math.max(
            1,
            Math.ceil((Number(row.reset_at) - now) / 1000),
          ),
        };
  } catch {
    return { ok: false, retryAfter: 60 };
  }
}
export function tooManyText(seconds: number) {
  return `操作暂不可用，请 ${Math.ceil(seconds)} 秒后再试`;
}
