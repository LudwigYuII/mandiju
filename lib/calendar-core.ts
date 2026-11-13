import { Solar } from "lunar-typescript";
import { siteDateParts } from "./time";
const LUNAR_FESTIVALS: Record<string, string> = {
  "1-1": "春节",
  "1-15": "元宵",
  "5-5": "端午",
  "7-7": "七夕",
  "8-15": "中秋",
  "9-9": "重阳",
};
const SOLAR_FESTIVALS: Record<string, string> = {
  "1-1": "元旦",
  "2-14": "情人节",
  "10-31": "万圣节",
  "12-25": "圣诞",
};
export function calendarEvents(date: Date = new Date()) {
  const { year, month, day } = siteDateParts(date);
  const lunar = Solar.fromYmd(year, month, day).getLunar();
  const events: { name: string; kind: "term" | "festival" }[] = [];
  const term = lunar.getJieQi();
  if (term) events.push({ name: term, kind: "term" });
  const solar = SOLAR_FESTIVALS[`${month}-${day}`];
  if (solar) events.push({ name: solar, kind: "festival" });
  // Negative lunar month means a leap month; do not repeat ordinary lunar festivals.
  const festival =
    lunar.getMonth() > 0
      ? LUNAR_FESTIVALS[`${lunar.getMonth()}-${lunar.getDay()}`]
      : null;
  if (festival) events.push({ name: festival, kind: "festival" });
  return events;
}
