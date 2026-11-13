import manifest from "@/data/manifest.json";
import { calendarEvents } from "./calendar-core";
import { siteDateParts } from "./time";
export type FirstDayEvent = {
  stampId: string;
  name: string;
  kind: "term" | "festival";
};
export function todayFirstDay(date: Date = new Date()): FirstDayEvent | null {
  for (const event of calendarEvents(date)) {
    const s = (manifest.stamps as any[]).find((s) =>
      event.kind === "term"
        ? s.acquire?.type === "solarTerm" && s.acquire.term === event.name
        : s.acquire?.type === "festival" && s.acquire.name === event.name,
    );
    if (s) return { stampId: s.id, ...event };
  }
  return null;
}
export type UpcomingDay = {
  name: string;
  kind: "term" | "festival";
  days: number;
};
export function upcomingFirstDays(
  withinDays = 7,
  from: Date = new Date(),
): UpcomingDay[] {
  const out: UpcomingDay[] = [];
  for (let off = 0; off <= withinDays; off++) {
    const event = todayFirstDay(new Date(from.getTime() + off * 86400000));
    if (event) out.push({ name: event.name, kind: event.kind, days: off });
  }
  return out;
}
export const SITE_BIRTHDAY: [number, number] = [11, 7];
export function isSiteAnniversary(date: Date = new Date()) {
  const d = siteDateParts(date);
  return d.month === 11 && d.day === 7;
}
export type SeasonStamp = {
  stampId: string;
  name: string;
  kind: "term" | "festival";
  label: string;
};
export function seasonalStamps(date: Date = new Date()): SeasonStamp[] {
  const e = todayFirstDay(date);
  return e ? [{ ...e, label: "岁时纪念" }] : [];
}
