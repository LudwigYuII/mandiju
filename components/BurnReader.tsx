"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { openBurnLetterAction, burnLetterAction } from "@/lib/actions";
import { genreLabel, postageLabel, fmtTime } from "@/lib/delivery";
import { burnLabel } from "@/lib/burn";
import { rustle } from "./Envelope";
import Seal, { sealToneOf, sealPatternOf, sealToneToRender, type LetterSealTone, type SealPattern } from "./Seal";
import { paperKindOf, paperClass, type PaperKind } from "./paper";
import Stamp from "./Stamp";

type Meta = {
  pen: string;
  seal: string;
  /** 信件自己的火漆色（旧信回落朱红） */
  sealColor?: LetterSealTone | string | null;
  /** 信件自己的火漆纹样（旧信回落素面） */
  sealPattern?: SealPattern | string | null;
  paper?: PaperKind | string | null;
  vertical?: number;
  stampFile: string | null;
  city: string;
  deliverAt: number;
  genre: string;
  postage: string;
  cost: number;
  recipientPen: string;
  burnSeconds: number;
};

type Content = { body: string; title: string; genre: string };

/** 阅后即焚的拆封与燃烧：信封 → 拆封取信（唯一一次下发正文） → 倒计时 → 焚毁 */
export default function BurnReader({ letterId, meta }: { letterId: string; meta: Meta }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"sealed" | "fetching" | "reading" | "burning" | "burned" | "error">(
    "sealed"
  );
  const [content, setContent] = useState<Content | null>(null);
  const [deadline, setDeadline] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [err, setErr] = useState("");
  const burningRef = useRef(false);

  const open = useCallback(async () => {
    if (phase === "fetching" || phase === "reading" || phase === "burning") return;
    rustle();
    setPhase("fetching");
    try {
      const res = await openBurnLetterAction(letterId);
      if ("error" in res) {
        setErr(res.error);
        setPhase("error");
        return;
      }
      if ("burned" in res) {
        setPhase("burned");
        return;
      }
      setContent({ body: res.body, title: res.title, genre: res.genre });
      setDeadline(res.deadline);
      setRemaining(Math.max(0, res.deadline - Date.now()));
      try {
        localStorage.setItem(`mdj-opened:${letterId}`, "1");
      } catch {}
      setPhase("reading");
    } catch {
      setErr("拆封失败，请刷新重试");
      setPhase("error");
    }
  }, [letterId, phase]);

  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // 倒计时内重新进入页面：自动续读（信封已拆过）
  useEffect(() => {
    try {
      if (localStorage.getItem(`mdj-opened:${letterId}`)) openRef.current();
    } catch {}
  }, [letterId]);

  // 倒计时
  useEffect(() => {
    if (phase !== "reading") return;
    const t = setInterval(async () => {
      const left = deadline - Date.now();
      setRemaining(Math.max(0, left));
      if (left <= 0 && !burningRef.current) {
        burningRef.current = true;
        clearInterval(t);
        setPhase("burning");
        try {
          await burnLetterAction(letterId);
        } catch {}
        setPhase("burned");
        setTimeout(() => router.replace("/mail"), 3400);
      }
    }, 200);
    return () => clearInterval(t);
  }, [phase, deadline, letterId, router]);

  if (phase === "sealed" || phase === "fetching") {
    return (
      <div
        className={`envelope-wrap ${phase === "fetching" ? "opening" : ""}`}
        onClick={() => phase === "sealed" && open()}
      >
        <div className="envelope-shell relative mx-auto flex h-[340px] max-w-md cursor-pointer select-none flex-col items-center justify-center overflow-hidden rounded-[26px] border border-black/5 bg-paper2/80 shadow-[0_16px_48px_-24px_rgba(58,46,28,0.22)] dark:border-white/10">
          {/* 信封折线 */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-0 top-0 h-px w-full bg-black/5 dark:bg-white/10" style={{ transform: "translateY(170px)" }} />
            <div
              className="absolute left-1/2 top-[170px] h-px w-full bg-black/5 dark:bg-white/10"
              style={{ transform: "translateX(-50%) rotate(-18deg)" }}
            />
            <div
              className="absolute left-1/2 top-[170px] h-px w-full bg-black/5 dark:bg-white/10"
              style={{ transform: "translateX(-50%) rotate(18deg)" }}
            />
          </div>
          {/* 封口 */}
          <div
            className="envelope-flap absolute left-0 top-0 h-[120px] w-full"
            style={{
              clipPath: "polygon(0 0, 100% 0, 50% 100%)",
              background: "var(--paper2)",
              borderBottom: "1px solid rgba(0,0,0,0.06)",
              transformOrigin: "top",
              zIndex: 2,
            }}
          />
          {/* 火漆印 */}
          <div className="envelope-seal relative z-[3] mt-16">
            <Seal
              char={meta.seal}
              size={76}
              tone={sealToneToRender(sealToneOf(meta.sealColor))}
              pattern={sealPatternOf(meta.sealPattern)}
            />
          </div>
          <p className="relative z-[3] mt-4 text-xs tracking-[0.3em] text-ink-soft">
            {phase === "fetching" ? "正在拆封…" : "🔥 拆封即燃"}
          </p>
          <p className="relative z-[3] mt-1 text-[11px] text-ink-soft/70">
            {meta.pen} 的阅后即焚信 · 拆开即开始 {burnLabel(meta.burnSeconds)} 倒计时
          </p>
        </div>
      </div>
    );
  }

  if (phase === "reading" && content) {
    const secs = Math.ceil(remaining / 1000);
    const pct = Math.max(0, Math.min(100, (remaining / (meta.burnSeconds * 1000)) * 100));
    const paper = paperKindOf(meta.paper);
    const vertical = Number(meta.vertical) === 1;
    return (
      <div className="space-y-4 pb-24">
        {/* 焚毁倒计时条 */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-vermilion/20 bg-paper/95 px-4 py-2.5 backdrop-blur dark:bg-[#191611]/95">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-vermilion">🔥 焚毁倒计时 {secs} 秒</span>
            <span className="text-ink-soft">{burnLabel(meta.burnSeconds)} · 读完即焚，只有这一次</span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <div className="h-full rounded-full bg-vermilion transition-[width] duration-200 ease-linear" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <article className={`letter-reveal card glass grain ${paperClass(paper)} p-6`}>
          {/* 抬头 */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Seal char={meta.seal} size={40} tone="blue" />
              <div>
                <div className="text-[16px] font-semibold">{meta.pen}</div>
                <div className="text-xs text-ink-soft">
                  {genreLabel(meta.genre)} · {postageLabel(meta.postage)} · {meta.cost} 文 · 寄给 {meta.recipientPen}
                </div>
              </div>
            </div>
            {meta.stampFile && <Stamp file={meta.stampFile} size={64} />}
          </div>

          {/* 正文 */}
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">{content.title}</h1>
          <div
            className={`mt-3 whitespace-pre-wrap text-[17px] ${
              content.genre === "poem" ? "poem" : "prose-letter"
            } ${vertical ? "writing-vertical" : ""}`}
          >
            {content.body}
          </div>

          {/* 落款 */}
          <div
            className={`mt-6 flex items-end justify-between border-t pt-4 ${
              paper === "night" ? "border-white/15" : "border-black/5 dark:border-white/10"
            }`}
          >
            <div className="text-sm text-ink-soft">
              {meta.city || "未盖章"}
              <div className="mt-1 text-xs">{fmtTime(meta.deliverAt)} 送达</div>
            </div>
            <Seal
              char={meta.seal}
              size={44}
              tone={sealToneToRender(sealToneOf(meta.sealColor))}
              pattern={sealPatternOf(meta.sealPattern)}
            />
          </div>
        </article>
      </div>
    );
  }

  if (phase === "burning") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
        <div className="stamp-flash pointer-events-none fixed inset-0 bg-vermilion" />
        <div className="card flex h-64 w-56 flex-col items-center justify-center gap-3 bg-paper text-center">
          <span className="burn-flame text-5xl">🔥</span>
          <p className="text-sm text-ink-soft">正在焚毁…</p>
        </div>
      </div>
    );
  }

  if (phase === "burned") {
    return (
      <div className="mx-auto max-w-md space-y-4 py-10 text-center">
        <div className="card glass grain p-8">
          <div className="ash-rise text-4xl">🌫️</div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">已焚毁</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">信已化为灰烬，风一吹就散了。</p>
          <p className="mt-4 text-xs text-ink-soft">正在带你回往来信笺…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card glass p-8 text-center">
      <p className="text-sm text-vermilion">{err || "这封信已经读不到了"}</p>
      <button type="button" className="btn mt-4" onClick={open}>
        重试拆封
      </button>
    </div>
  );
}
