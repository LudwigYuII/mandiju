// 同题共写：轮值邮差、当月限定票、当月主题
import { db } from "./db";
import manifest from "@/data/manifest.json";

export function monthKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const MONTH_TERM: Record<number, string> = {
  1: "小寒", 2: "立春", 3: "惊蛰", 4: "清明", 5: "立夏", 6: "芒种",
  7: "小暑", 8: "立秋", 9: "白露", 10: "寒露", 11: "立冬", 12: "大雪",
};

/** 当月限定票（节气票），用于同题纪念 */
export function monthStamp(): { id: string; name: string; file: string } | null {
  const term = MONTH_TERM[new Date().getMonth() + 1];
  const s = (manifest.stamps as any[]).find(
    (x: any) => x.acquire?.type === "solarTerm" && x.acquire.term === term
  );
  return s ? { id: s.id, name: s.name, file: s.file } : null;
}

/** 轮值邮差：按入局顺序每月轮换 */
export async function currentHost(): Promise<{ id: string; pen: string } | null> {
  const users = await db.execute("SELECT id, pen_name FROM users ORDER BY created_at ASC");
  if (users.rows.length === 0) return null;
  const n = new Date().getFullYear() * 12 + new Date().getMonth();
  const row = users.rows[n % users.rows.length] as any;
  return { id: String(row.id), pen: String(row.pen_name) };
}

export async function getCurrentTopic(): Promise<any | null> {
  const r = await db.execute({ sql: "SELECT * FROM topics WHERE month=? LIMIT 1", args: [monthKey()] });
  return (r.rows[0] as any) ?? null;
}

export async function getTopicById(id: string): Promise<any | null> {
  const r = await db.execute({ sql: "SELECT * FROM topics WHERE id=?", args: [id] });
  return (r.rows[0] as any) ?? null;
}
