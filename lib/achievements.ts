/**
 * 寄信成就（集邮册解锁）：纯函数模块。
 *
 * 约束：不 import db / fs / next/*，也不做任何副作用——本模块会被客户端组件
 * （写信页的信纸/火漆选择器、邮票册成就区块）直接引用。
 * 寄信数以 users.letters_sent 为准，与设置页「已寄出 N 封信」同一口径；
 * 数据库查询一律放在页面/layout 的 server 侧（见 lib/stamps.ts 的 sentLetterCount）。
 */
import type { PaperKind } from "@/components/paper";
import type { LetterSealTone, SealPattern } from "@/components/Seal";

export type Milestone = {
  /** 达到该寄出封数即解锁 */
  sent: number;
  /** 档位名：邮件里与邮票册上的短标签 */
  label: string;
  /** 一句笺注，说明这一档的意味 */
  desc: string;
  papers?: PaperKind[];
  patterns?: SealPattern[];
  tones?: LetterSealTone[];
};

/** 恒可用的基础款：素笺 · 素面 · 朱红（第一封信起就常伴） */
export const BASE_PAPERS: PaperKind[] = ["plain"];
export const BASE_PATTERNS: SealPattern[] = ["plain"];
export const BASE_TONES: LetterSealTone[] = ["vermilion"];

export const PAPER_LABEL: Record<PaperKind, string> = {
  plain: "素笺",
  xuan: "宣纸",
  gold: "洒金",
  night: "夜笺",
};

export const PATTERN_LABEL: Record<SealPattern, string> = {
  plain: "素面",
  wave: "水波",
  star: "星光",
  rings: "回纹",
};

export const TONE_LABEL: Record<LetterSealTone, string> = {
  vermilion: "朱红",
  indigo: "靛蓝",
  ink: "墨黑",
  jade: "青碧",
};

/**
 * 里程碑阶梯：1 / 3 / 5 / 10 / 25 / 50 封。
 * 节奏由密到疏——前几封很快见到回响，往后每一档都需要真正的往返。
 * 三档信纸 × 三档封蜡纹样 × 三档蜡色，共 9 件解锁物全部落在阶梯上。
 */
const STEPS: Milestone[] = [
  {
    sent: 1,
    label: "初寄",
    desc: "见字如面，第一封信已启程。",
    papers: ["xuan"],
  },
  {
    sent: 3,
    label: "三缄",
    desc: "三回往复，话已投机。",
    patterns: ["wave"],
  },
  {
    sent: 5,
    label: "五笺",
    desc: "五度传书，提笔渐成习惯。",
    tones: ["indigo"],
  },
  {
    sent: 10,
    label: "十书",
    desc: "十封往来，笔墨自成气候。",
    papers: ["gold"],
    patterns: ["star"],
  },
  {
    sent: 25,
    label: "廿五",
    desc: "廿五封信，山长水远亦有人应。",
    patterns: ["rings"],
    tones: ["ink"],
  },
  {
    sent: 50,
    label: "半百",
    desc: "半百书简，慢递已成旧友。",
    papers: ["night"],
    tones: ["jade"],
  },
];

/** 全部里程碑（按寄出封数升序） */
export function milestones(): Milestone[] {
  return STEPS.map((m) => ({ ...m }));
}

export type AchievementState = Milestone & {
  /** 是否已达成 */
  reached: boolean;
  /** 距达成还差几封（已达成时为 0） */
  remaining: number;
  /** 本档区间内的进度 0–1（上一档达成后从 0 起算，已达成为 1） */
  progress: number;
};

function normalizeCount(sentCount: number): number {
  const n = Math.floor(Number(sentCount));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** 每档是否达成 + 本档进度 */
export function achievementsFor(sentCount: number): AchievementState[] {
  const n = normalizeCount(sentCount);
  let prev = 0;
  return STEPS.map((m) => {
    const reached = n >= m.sent;
    const span = Math.max(1, m.sent - prev);
    const progress = reached ? 1 : Math.max(0, Math.min(1, (n - prev) / span));
    prev = m.sent;
    return {
      ...m,
      reached,
      remaining: Math.max(0, m.sent - n),
      progress,
    };
  });
}

/** 下一档里程碑（全部达成时为 null） */
export function nextMilestone(sentCount: number): Milestone | null {
  const n = normalizeCount(sentCount);
  const m = STEPS.find((x) => n < x.sent);
  return m ? { ...m } : null;
}

function reachedSteps(sentCount: number): Milestone[] {
  const n = normalizeCount(sentCount);
  return STEPS.filter((m) => n >= m.sent);
}

/** 已解锁的信纸（含基础款素笺） */
export function unlockedPapers(sentCount: number): Set<PaperKind> {
  const set = new Set<PaperKind>(BASE_PAPERS);
  for (const m of reachedSteps(sentCount)) for (const p of m.papers ?? []) set.add(p);
  return set;
}

/** 已解锁的封蜡纹样（含基础款素面） */
export function unlockedPatterns(sentCount: number): Set<SealPattern> {
  const set = new Set<SealPattern>(BASE_PATTERNS);
  for (const m of reachedSteps(sentCount)) for (const p of m.patterns ?? []) set.add(p);
  return set;
}

/** 已解锁的封蜡蜡色（含基础款朱红） */
export function unlockedTones(sentCount: number): Set<LetterSealTone> {
  const set = new Set<LetterSealTone>(BASE_TONES);
  for (const m of reachedSteps(sentCount)) for (const t of m.tones ?? []) set.add(t);
  return set;
}

/** 单项判定：写信页做锁定态时用，避免到处 new Set */
export function paperUnlocked(kind: PaperKind, sentCount: number): boolean {
  return unlockedPapers(sentCount).has(kind);
}

export function patternUnlocked(pattern: SealPattern, sentCount: number): boolean {
  return unlockedPatterns(sentCount).has(pattern);
}

export function toneUnlocked(tone: LetterSealTone, sentCount: number): boolean {
  return unlockedTones(sentCount).has(tone);
}

/** 一次取齐三套解锁集合，写页面 props 时省事 */
export function unlockedFor(sentCount: number): {
  papers: Set<PaperKind>;
  patterns: Set<SealPattern>;
  tones: Set<LetterSealTone>;
} {
  return {
    papers: unlockedPapers(sentCount),
    patterns: unlockedPatterns(sentCount),
    tones: unlockedTones(sentCount),
  };
}

/** 该档解锁物的可读文案：「信纸·宣纸」「封蜡·水波」「蜡色·靛蓝」 */
export function unlockText(m: Pick<Milestone, "papers" | "patterns" | "tones">): string {
  const parts: string[] = [];
  for (const p of m.papers ?? []) parts.push(`信纸·${PAPER_LABEL[p]}`);
  for (const p of m.patterns ?? []) parts.push(`封蜡·${PATTERN_LABEL[p]}`);
  for (const t of m.tones ?? []) parts.push(`蜡色·${TONE_LABEL[t]}`);
  return parts.join("、");
}
