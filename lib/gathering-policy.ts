import { SITE_TIME_ZONE } from "./time";
/** A wall time in the declared site zone; reject missing and repeated DST minutes. */
export function gatheringTime(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error("请填写完整的活动时间");
  const target = Date.parse(value + ":00Z");
  if (
    !Number.isFinite(target) ||
    new Date(target).toISOString().slice(0, 16) !== value
  )
    throw new Error("活动日期无效");
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: SITE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const wall = (ms: number) => {
    const p = fmt.formatToParts(ms);
    const get = (k: string) => Number(p.find((x) => x.type === k)?.value);
    return Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
    );
  };
  const matches = new Set<number>();
  // Sample offsets on both sides of a possible transition, including non-hour changes.
  for (const delta of [-86400000, 0, 86400000]) {
    const candidate = target - (wall(target + delta) - (target + delta));
    if (wall(candidate) === target) matches.add(candidate);
  }
  if (matches.size !== 1)
    throw new Error("此时间遇到时区切换，请另选一个明确的时间");
  return [...matches][0];
}
export function gatheringPhase(start: number, end: number, now = Date.now()) {
  return now >= end ? "ended" : now < start ? "upcoming" : "open";
}
