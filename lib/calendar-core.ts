import { Solar } from "lunar-typescript";
import { siteDateParts } from "./time";
import config from "@/data/seasons.json";
const LUNAR_FESTIVALS: Record<string,string> = config.lunar_festivals;
const SOLAR_FESTIVALS: Record<string,string> = config.solar_festivals;
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
