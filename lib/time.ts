export const SITE_TIME_ZONE =
  process.env.NEXT_PUBLIC_SITE_TIME_ZONE ||
  process.env.MDJ_SITE_TIME_ZONE ||
  "Asia/Shanghai";
export function siteDateParts(date: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SITE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}
export function siteDateKey(date: Date = new Date()) {
  const p = siteDateParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}
export function formatSiteTime(ms: number) {
  if(ms >= 253402300799000) return "暂存中";
  return new Intl.DateTimeFormat("zh-Hans", {
    timeZone: SITE_TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(ms);
}

export function siteDateStart(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const desired = Date.UTC(year, month - 1, day);
  if (new Date(desired).toISOString().slice(0, 10) !== value) return null;
  let guess = desired;
  const format = new Intl.DateTimeFormat("en-GB", {
    timeZone: SITE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  for (let i = 0; i < 5; i++) {
    const parts = format.formatToParts(guess);
    const get = (key: string) =>
      Number(parts.find((p) => p.type === key)?.value);
    const local = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second"),
    );
    if (local === desired) return guess;
    guess += desired - local;
  }
  return null; // A missing midnight at a daylight-saving boundary must be chosen explicitly.
}
