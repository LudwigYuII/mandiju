import { db } from "./db";
import manifest from "@/data/manifest.json";
import { isSiteAnniversary, seasonalStamps } from "./calendar";
import { notify } from "./notify";

export function weatherCodeToStampId(code: number | null, gust: number | null): string | null {
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
    await notify(uid, "stamp", `解锁新邮票：${def?.name ?? stampId}`, "/stamps");
  }
}

export async function ownedStampIds(uid: string): Promise<Set<string>> {
  const r = await db.execute({ sql: "SELECT stamp_id FROM user_stamps WHERE user_id=?", args: [uid] });
  return new Set(r.rows.map((x) => String(x.stamp_id)));
}

export async function availableStamps(uid: string) {
  const owned = await ownedStampIds(uid);
  const season = new Map(seasonalStamps().map((s) => [s.stampId, s]));
  return (manifest.stamps as any[]).filter(
    (s) => s.acquire.type === "common" || owned.has(s.id) || season.has(s.id)
  ).map((s) => {
    const se = season.get(s.id);
    return se ? { ...s, seasonal: se.label } : s;
  });
}

/** 是否处于当年发行窗口（可选用、用后解锁） */
export function isSeasonalStamp(stampId: string): { kind: string; name: string } | null {
  const s = seasonalStamps().find((x) => x.stampId === stampId);
  return s ? { kind: s.kind, name: s.name } : null;
}

export async function applySendGrants(uid: string, sent: number, weatherStampId: string | null) {
  if (sent === 10) await grantStamp(uid, "B05", "第10封信·成人礼");
  if (sent === 50) await grantStamp(uid, "B06", "第50封信");
  if (sent === 100) await grantStamp(uid, "B07", "第100封信");
  if (isSiteAnniversary()) await grantStamp(uid, "B08", "建站周年");
  if (weatherStampId) await grantStamp(uid, weatherStampId, "气候·随信");
  const u = await db.execute({ sql: "SELECT birthday FROM users WHERE id=?", args: [uid] });
  const bday = String(u.rows[0]?.birthday ?? "");
  if (bday) {
    const [m, d] = bday.split("-");
    const now = new Date();
    if (Number(m) === now.getMonth() + 1 && Number(d) === now.getDate()) {
      await grantStamp(uid, "B15", "生辰");
    }
  }
}
