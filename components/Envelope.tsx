"use client";

import { useEffect, useState } from "react";
import Seal from "./Seal";

/** 信封拆封仪式：首次打开一封信时，先看到封好的信封，点击启封后展开信纸 */
export default function Envelope({
  letterId,
  seal,
  children,
}: {
  letterId: string;
  seal: string;
  children: React.ReactNode;
}) {
  const [phase, setPhase] = useState<"sealed" | "opening" | "open">("sealed");

  useEffect(() => {
    try {
      if (localStorage.getItem(`mdj-opened:${letterId}`)) {
        setPhase("open");
      }
    } catch {}
  }, [letterId]);

  const open = () => {
    if (phase !== "sealed") return;
    rustle();
    setPhase("opening");
    setTimeout(() => {
      try {
        localStorage.setItem(`mdj-opened:${letterId}`, "1");
      } catch {}
      setPhase("open");
    }, 750);
  };

  if (phase === "open") {
    return <div className="letter-reveal">{children}</div>;
  }

  return (
    <div className={`envelope-wrap ${phase === "opening" ? "opening" : ""}`} onClick={open}>
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
          <Seal char={seal} size={76} tone="vermilion" />
        </div>
        <p className="relative z-[3] mt-4 text-xs tracking-[0.3em] text-ink-soft">点击启封</p>
        <p className="relative z-[3] mt-1 text-[11px] text-ink-soft/70">寄给你的信，要亲手拆开</p>
      </div>
    </div>
  );
}

/** 纸张窸窣声 */
function rustle() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const len = Math.floor(ctx.sampleRate * 0.28);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      data[i] = (Math.random() * 2 - 1) * (1 - t) * (0.5 + 0.5 * Math.sin(t * Math.PI * 9));
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.16, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
    src.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    src.start();
  } catch {}
}
