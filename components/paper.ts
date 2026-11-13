/** 信纸样式：类型与归一化辅助（客户端/服务端皆可安全引用，不依赖数据库） */

export type PaperKind = "plain" | "xuan" | "gold" | "night";

export const PAPER_KINDS: PaperKind[] = ["plain", "xuan", "gold", "night"];

/** 归一化数据库里的信纸样式（旧信可能为空，回落素笺） */
export function paperKindOf(v: string | null | undefined): PaperKind {
  return (PAPER_KINDS as string[]).includes(String(v))
    ? (String(v) as PaperKind)
    : "plain";
}

/** 对应 globals.css 里的 .paper-xuan / .paper-gold / .paper-night（素笺无类） */
export function paperClass(v: string | null | undefined): string {
  const k = paperKindOf(v);
  return k === "plain" ? "" : `paper-${k}`;
}
