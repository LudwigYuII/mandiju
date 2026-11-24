/** 信纸样式：类型与归一化辅助（客户端/服务端皆可安全引用，不依赖数据库） */

export type FloralPaper = `flower-${"cream"|"jade"|"rose"}-${"lines"|"dots"|"clear"}-${"frame"|"plain"}`;
export type PaperKind = FloralPaper | "plain" | "xuan" | "gold" | "night";

export const PAPER_KINDS: PaperKind[] = ["plain", "xuan", "gold", "night"];

/** 归一化数据库里的信纸样式（旧信可能为空，回落素笺） */
export function paperKindOf(v: string | null | undefined): PaperKind {
  if (isFloralPaper(v)) return v;
  return (PAPER_KINDS as string[]).includes(String(v))
    ? (String(v) as PaperKind)
    : "plain";
}

/** 对应 globals.css 里的 .paper-xuan / .paper-gold / .paper-night（素笺无类） */
export function paperClass(v: string | null | undefined): string {
  const k = paperKindOf(v);
  if (isFloralPaper(k)) return "flower-paper "+k.split("-").slice(1).map(x=>"flower-"+x).join(" ");
  return k === "plain" ? "" : `paper-${k}`;
}

export function isFloralPaper(value: unknown): value is FloralPaper {
  return typeof value==="string" && /^flower-(cream|jade|rose)-(lines|dots|clear)-(frame|plain)$/.test(value);
}
