"use client";
import { UiInput, UiText } from "@/components/UiText";

import { useState } from "react";

export default function QuotesLibrary({ quotes }: { quotes: string[] }) {
  const [kw, setKw] = useState("");
  const [copied, setCopied] = useState(-1);
  const list = kw.trim() ? quotes.filter((q) => q.includes(kw.trim())) : quotes;

  const copy = async (q: string, i: number) => {
    try {
      await navigator.clipboard.writeText(q);
      setCopied(i);
      setTimeout(() => setCopied(-1), 1600);
    } catch {}
  };

  return (
    <div>
      <UiInput
        className="input"
        placeholder="搜一句……"
        value={kw}
        onChange={(e) => setKw(e.target.value)}
      />
      <p className="mt-2 text-xs text-ink-soft">
        <UiText text={"共"} />
        {quotes.length}
        <UiText text={"条 · 点任意一句即可复制"} />
      </p>
      <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
        {list.map((q, i) => (
          <button
            key={q}
            onClick={() => copy(q, i)}
            className={`card p-4 text-left text-[15px] leading-relaxed transition hover:-translate-y-0.5 ${
              copied === i ? "!border-vermilion/50" : ""
            }`}
          >
            {copied === i ? (
              <span className="text-vermilion">
                <UiText text={"已复制 ✓"} />
              </span>
            ) : null}
            {q}
          </button>
        ))}
      </div>
      {list.length === 0 && (
        <p className="py-10 text-center text-sm text-ink-soft">
          <UiText text={"没找到相关句子"} />
        </p>
      )}
    </div>
  );
}
