import { db } from "./db";
import manifest from "@/data/manifest.json";
import { isSiteAnniversary, seasonalStamps } from "./calendar";
import { notify } from "./notify";
import { achievementsFor, unlockText } from "./achievements";

export function weatherCodeToStampId(
  code: number | null,
  gust: number | null,
): string | null {
  if (code == null) return null;
  if (code === 45 || code === 48) return "B11"; // 大雾
  if ([65, 66, 67, 82].includes(code)) return "B10"; // 暴雨
  if ([95, 96, 99].includes(code)) return "B13"; // 雷电
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "B09"; // 初雪
  if (gust != null && gust >= 30) return "B14"; // 大风
  return null;
}

export async function grantStamp(uid: string, stampId: string, source: string) {
  const r = await db.execute({
    sql: "INSERT OR IGNORE INTO user_stamps(user_id, stamp_id, acquired_at, source) VALUES(?,?,?,?)",
    args: [uid, stampId, Date.now(), source],
  });
  if (Number((r as any)?.rowsAffected ?? 0) > 0) {
    const def = (manifest.stamps as any[]).find((s) => s.id === stampId);
    await notify(
      uid,
      "stamp",
      `解锁新邮票：${def?.name ?? stampId}`,
      "/stamps",
    );
  }
}

export async function ownedStampIds(uid: string): Promise<Set<string>> {
  const r = await db.execute({
    sql: "SELECT stamp_id FROM user_stamps WHERE user_id=?",
    args: [uid],
  });
  return new Set(r.rows.map((x) => String(x.stamp_id)));
}

export async function availableStamps(uid: string) {
  return (manifest.stamps as any[]).map((s) => ({ ...s, seasonal: "" }));
}

/** 是否处于当年发行窗口（可选用、用后解锁） */
export function isSeasonalStamp(
  stampId: string,
): { kind: string; name: string } | null {
  const s = seasonalStamps().find((x) => x.stampId === stampId);
  return s ? { kind: s.kind, name: s.name } : null;
}

export async function applySendGrants(
  _uid: string,
  _sent: number,
  _weatherStampId: string | null,
) {
  /* retired */
}

/** 已寄出封信数：与设置页「已寄出 N 封信」同一口径（users.letters_sent，含时光胶囊） */
export async function sentLetterCount(uid: string): Promise<number> {
  const r = await db.execute({
    sql: "SELECT letters_sent FROM users WHERE id=?",
    args: [uid],
  });
  const n = Number((r.rows[0] as any)?.letters_sent ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * 寄信里程碑解锁（幂等）：user_achievements 主键 (user_id, milestone)，
 * INSERT OR IGNORE 未命中则说明此前已发放过，不再重复通知。
 * 理想调用点是发信动作成功之后（lib/actions.ts），邮票册页也会兜底调用一次。
 */
export async function applyAchievementGrants(
  uid: string,
  sent?: number,
): Promise<void> {
  // Historical collections and achievement rows are never deleted.
}
