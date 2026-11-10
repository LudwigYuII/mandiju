import Seal, { sealToneToRender, type LetterSealTone } from "@/components/Seal";
import { paperClass } from "@/components/paper";
import {
  achievementsFor,
  nextMilestone,
  PAPER_LABEL,
  PATTERN_LABEL,
  TONE_LABEL,
} from "@/lib/achievements";

/** 里程碑印章字：一 / 三 / 五 / 十 / 廿 / 半（超出阶梯时回落数字） */
const MILESTONE_CHAR: Record<number, string> = {
  1: "一",
  3: "三",
  5: "五",
  10: "十",
  25: "廿",
  50: "半",
};

/** 蜡色色值（与写信页蜡色选择器一致） */
const TONE_SWATCH: Record<LetterSealTone, string> = {
  vermilion: "#c03a2b",
  indigo: "#4a6b8a",
  ink: "#433d35",
  jade: "#3f7d6e",
};

/**
 * 寄信成就进度：邮票册顶部的「集邮册」区块。
 * 纯展示组件（无 hooks），服务端渲染即可；所有判定来自 lib/achievements.ts。
 */
export default function AchievementProgress({
  sent,
  className = "",
}: {
  /** 已寄出封信数（users.letters_sent） */
  sent: number;
  className?: string;
}) {
  const states = achievementsFor(sent);
  const done = states.filter((s) => s.reached).length;
  const next = nextMilestone(sent);
  const pct = next ? Math.min(100, Math.max(0, Math.round((sent / next.sent) * 100))) : 100;
  const nextRemaining = next ? next.sent - sent : 0;

  return (
    <section
      aria-label="寄信成就"
      className={`card grain relative overflow-hidden p-5 sm:p-6 ${className}`}
    >
      {/* 角落淡印，克制的朱红点缀 */}
      <div className="pointer-events-none absolute -right-7 -top-7 opacity-[0.05]">
        <Seal char="寄" size={156} tone="vermilion" pattern="rings" />
      </div>

      <div className="relative flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold tracking-[0.18em] text-ink-soft">寄信成就</h2>
          <p className="mt-1 text-2xl font-semibold tracking-tight">
            已寄 <span className="tabular-nums">{sent}</span> 封
          </p>
        </div>
        <span className="rounded-full bg-vermilion/10 px-3 py-1 text-xs font-medium text-vermilion">
          已解锁 <span className="tabular-nums">{done}</span> / {states.length} 档
        </span>
      </div>

      {/* 下一档进度 */}
      <div className="relative mt-4">
        <div className="flex items-baseline justify-between gap-3 text-xs text-ink-soft">
          <span>
            {next ? (
              <>
                再寄 <span className="tabular-nums text-vermilion">{nextRemaining}</span> 封，解锁「
                {next.label}」
              </>
            ) : (
              "六档已满，笺色纹样尽在掌中"
            )}
          </span>
          <span className="tabular-nums">{next ? `${sent} / ${next.sent}` : `${sent} 封`}</span>
        </div>
        <div
          role="progressbar"
          aria-label="下一档寄信成就进度"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10"
        >
          <div
            className="h-full rounded-full bg-vermilion/80 transition-[width] duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* 里程碑阶梯 */}
      <ol className="relative mt-5 space-y-2">
        {states.map((a) => {
          const char = MILESTONE_CHAR[a.sent] ?? String(a.sent);
          const previewTone = a.tones?.[0] ?? "vermilion";
          const previewPattern = a.patterns?.[0] ?? "plain";
          return (
            <li
              key={a.sent}
              className={`flex items-start gap-3 rounded-2xl border p-3 transition-colors ${
                a.reached
                  ? "border-vermilion/20 bg-vermilion/[0.04]"
                  : "border-black/[0.06] dark:border-white/[0.08]"
              }`}
            >
              <div className={`mt-0.5 shrink-0 ${a.reached ? "" : "opacity-30 grayscale"}`}>
                <Seal
                  char={char}
                  size={38}
                  tone={sealToneToRender(previewTone)}
                  pattern={previewPattern}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-sm font-semibold">「{a.label}」</span>
                  <span className="text-[11px] text-ink-soft">第 {a.sent} 封</span>
                  <span
                    className={`ml-auto text-[11px] ${
                      a.reached ? "text-vermilion" : "text-ink-soft/70"
                    }`}
                  >
                    {a.reached ? "已解锁" : `还差 ${a.remaining} 封`}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-ink-soft">{a.desc}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {a.papers?.map((p) => (
                    <span
                      key={`paper-${p}`}
                      className={`${paperClass(p)} rounded-full border border-black/10 px-2 py-0.5 text-[10px] dark:border-white/15 ${
                        p === "night" ? "text-[#d8d0bf]" : "text-ink-soft"
                      } ${a.reached ? "" : "opacity-55"}`}
                    >
                      信纸·{PAPER_LABEL[p]}
                    </span>
                  ))}
                  {a.patterns?.map((p) => (
                    <span
                      key={`pattern-${p}`}
                      className={`inline-flex items-center gap-1 rounded-full border border-black/10 px-2 py-0.5 text-[10px] text-ink-soft dark:border-white/15 ${
                        a.reached ? "" : "opacity-55"
                      }`}
                    >
                      <Seal char="印" size={13} pattern={p} tone="vermilion" />
                      封蜡·{PATTERN_LABEL[p]}
                    </span>
                  ))}
                  {a.tones?.map((t) => (
                    <span
                      key={`tone-${t}`}
                      className={`inline-flex items-center gap-1 rounded-full border border-black/10 px-2 py-0.5 text-[10px] text-ink-soft dark:border-white/15 ${
                        a.reached ? "" : "opacity-55"
                      }`}
                    >
                      <i
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: TONE_SWATCH[t] }}
                      />
                      蜡色·{TONE_LABEL[t]}
                    </span>
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <p className="relative mt-4 text-center text-[11px] leading-relaxed text-ink-soft/80">
        素笺 · 素面 · 朱红，自第一封信起常伴；每寄出一封计一封（含时光胶囊）。
      </p>
    </section>
  );
}
