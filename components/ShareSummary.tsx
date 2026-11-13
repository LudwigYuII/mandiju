"use client";
import { UiText } from "@/components/UiText";

import { useState } from "react";

export default function ShareSummary({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch {}
  };
  return (
    <button onClick={copy} className="btn-ghost !px-5 !py-2 !text-sm">
      <UiText text={done ? "已复制 ✓" : "复制我的年度摘要"} />
    </button>
  );
}
