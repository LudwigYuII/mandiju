// 节气与节日首日（用于首日戳与纪念票发放）
import manifest from "@/data/manifest.json";

const TERMS: Record<string, [number, number]> = {
  小寒: [1, 6], 大寒: [1, 20], 立春: [2, 4], 雨水: [2, 19], 惊蛰: [3, 6], 春分: [3, 21],
  清明: [4, 5], 谷雨: [4, 20], 立夏: [5, 6], 小满: [5, 21], 芒种: [6, 6], 夏至: [6, 21],
  小暑: [7, 7], 大暑: [7, 23], 立秋: [8, 7], 处暑: [8, 23], 白露: [9, 8], 秋分: [9, 23],
  寒露: [10, 8], 霜降: [10, 23], 立冬: [11, 7], 小雪: [11, 22], 大雪: [12, 7], 冬至: [12, 22],
};

// 公历节日 + 农历节日（2026 年日期；其他年份农历节日暂按 2026 表，后续接入农历库校准）
const FESTS: Record<string, [number, number]> = {
  元旦: [1, 1], 情人节: [2, 14], 春节: [2, 17], 元宵: [3, 3], 端午: [6, 19], 七夕: [8, 19],
  中秋: [9, 25], 重阳: [10, 18], 万圣节: [10, 31], 圣诞: [12, 25],
};

function stampByTerm(term: string) {
  const s = (manifest.stamps as any[]).find(
    (x: any) => x.acquire?.type === "solarTerm" && x.acquire.term === term
  );
  return s ? { id: s.id, name: s.name, file: s.file } : null;
}

function stampByFest(name: string) {
  const s = (manifest.stamps as any[]).find(
    (x: any) => x.acquire?.type === "festival" && x.acquire.name === name
  );
  return s ? { id: s.id, name: s.name, file: s.file } : null;
}

export type FirstDayEvent = { stampId: string; name: string; kind: "term" | "festival" };

/** 今天是否是某个节气/节日的发行首日 */
export function todayFirstDay(d: Date = new Date()): FirstDayEvent | null {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  for (const [term, [tm, td]] of Object.entries(TERMS)) {
    if (tm === m && td === day) {
      const s = stampByTerm(term);
      if (s) return { stampId: s.id, name: term, kind: "term" };
    }
  }
  for (const [f, [fm, fd]] of Object.entries(FESTS)) {
    if (fm === m && fd === day) {
      const s = stampByFest(f);
      if (s) return { stampId: s.id, name: f, kind: "festival" };
    }
  }
  return null;
}

export type UpcomingDay = { name: string; kind: "term" | "festival"; days: number };

/** 未来几天内的发行首日（用于首页提醒） */
export function upcomingFirstDays(withinDays: number = 7, from: Date = new Date()): UpcomingDay[] {
  const out: UpcomingDay[] = [];
  for (let off = 0; off <= withinDays; off++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + off);
    const fd = todayFirstDay(d);
    if (fd) out.push({ name: fd.name, kind: fd.kind, days: off });
  }
  return out;
}

/** 建站日（周年纪念票 B08） */
export const SITE_BIRTHDAY: [number, number] = [11, 7];

export function isSiteAnniversary(d: Date = new Date()): boolean {
  return d.getMonth() + 1 === SITE_BIRTHDAY[0] && d.getDate() === SITE_BIRTHDAY[1];
}

export type SeasonStamp = {
  stampId: string;
  name: string;
  kind: "term" | "festival";
  label: string; // 展示标签：今日限定 / 发行中
};

/**
 * 当年限定的发行窗口：
 * - 节气：仅节气当日
 * - 节日：节日前后 3 天
 * 只对 2026 年版图案生效；次年将发行新图案（新 stamp id）。
 */
export function seasonalStamps(d: Date = new Date()): SeasonStamp[] {
  const year = d.getFullYear();
  if (year !== 2026) return []; // 当年限定
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const out: SeasonStamp[] = [];

  for (const [term, [tm, td]] of Object.entries(TERMS)) {
    if (tm === m && td === day) {
      const s = stampByTerm(term);
      if (s) out.push({ stampId: s.id, name: term, kind: "term", label: "今日限定" });
    }
  }
  for (const [f, [fm, fd]] of Object.entries(FESTS)) {
    const fest = new Date(year, fm - 1, fd).getTime();
    const now = new Date(year, m - 1, day).getTime();
    const diffDays = Math.round((now - fest) / 86_400_000);
    if (diffDays >= -3 && diffDays <= 3) {
      const s = stampByFest(f);
      if (s) out.push({ stampId: s.id, name: f, kind: "festival", label: "发行中" });
    }
  }
  return out;
}
