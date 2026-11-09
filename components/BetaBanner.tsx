"use client";

import { useEffect, useState } from "react";

const KEY = "mdj-banner-15";

export default function BetaBanner() {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(KEY) === "1");
    } catch {}
  }, []);

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
  };

  if (hidden) return null;

  return (
    <div className="relative bg-vermilion/95 px-10 py-2 text-center text-xs leading-relaxed text-white">
      v1.5 鸿雁更新：笔友系统、拆封仪式、站长后台与提速已上线。
      <a href="/changelog" className="underline underline-offset-2">
        查看更新日志 →
      </a>
      <button
        onClick={dismiss}
        aria-label="关闭"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 text-base text-white/80 transition hover:bg-white/15 hover:text-white"
      >
        ✕
      </button>
    </div>
  );
}
