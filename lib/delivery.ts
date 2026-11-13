import { formatSiteTime } from "./time";
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
  {
    id: "surface",
    label: "驿马",
    desc: "1–24 小时，随信慢行",
    min: 1,
    max: 24,
    unit: "hour",
    cost: 0,
  },
];

const UNIT_MS: Record<string, number> = {
  min: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
};

export function postageLabel(id: string): string {
  return id === "air"
    ? "急递（旧制）"
    : id === "slow"
      ? "慢信（旧制）"
      : id === "capsule"
        ? "寄给未来"
        : "驿马";
}

export function postageCost(id: string): number {
  return 0;
}

export function deliverAt(postageId: string, now: number = Date.now()): number {
  const p = POSTAGE.find((x) => x.id === postageId) ?? POSTAGE[0];
  const min = Math.max(
    1,
    Math.min(168, Number(process.env.MDJ_DELIVERY_MIN_HOURS) || 1),
  );
  const max = Math.max(
    min,
    Math.min(168, Number(process.env.MDJ_DELIVERY_MAX_HOURS) || 24),
  );
  const base = min * UNIT_MS.hour;
  const span = (max - min) * UNIT_MS.hour;
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
  return formatSiteTime(ms);
}
