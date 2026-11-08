export type PostageId = "air" | "surface" | "slow";

export const POSTAGE: {
  id: PostageId;
  label: string;
  desc: string;
  min: number;
  max: number;
  unit: "min" | "hour" | "day";
  cost: number;
}[] = [
  { id: "air", label: "急递", desc: "约 10 分钟", min: 10, max: 10, unit: "min", cost: 100 },
  { id: "surface", label: "平信", desc: "2–5 小时", min: 2, max: 5, unit: "hour", cost: 50 },
  { id: "slow", label: "慢信", desc: "1–2 天", min: 1, max: 2, unit: "day", cost: 20 },
];

const UNIT_MS: Record<string, number> = { min: 60_000, hour: 3_600_000, day: 86_400_000 };

export function postageLabel(id: string): string {
  return POSTAGE.find((p) => p.id === id)?.label ?? "平信";
}

export function postageCost(id: string): number {
  return POSTAGE.find((p) => p.id === id)?.cost ?? 50;
}

export function deliverAt(postageId: string, now: number = Date.now()): number {
  const p = POSTAGE.find((x) => x.id === postageId) ?? POSTAGE[1];
  const base = p.min * UNIT_MS[p.unit];
  const span = (p.max - p.min) * UNIT_MS[p.unit];
  return now + base + Math.floor(Math.random() * (span + 1));
}

export function statusOf(deliverAtMs: number): "in_transit" | "delivered" {
  return Date.now() >= deliverAtMs ? "delivered" : "in_transit";
}

export const GENRES = [
  { id: "letter", label: "书信" },
  { id: "daily", label: "日常" },
  { id: "poem", label: "诗歌" },
  { id: "postcard", label: "明信片" },
] as const;

export function genreLabel(id: string): string {
  return GENRES.find((g) => g.id === id)?.label ?? "书信";
}

export function fmtTime(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  const md = `${d.getMonth() + 1}月${d.getDate()}日`;
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return sameYear ? `${md} ${hm}` : `${d.getFullYear()}年${md} ${hm}`;
}
