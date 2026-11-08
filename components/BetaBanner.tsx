"use client";

import { useEffect, useState } from "react";

const KEY = "mdj-banner-2026";

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
      本网站目前仍处于内部测试阶段，如有任何技术故障敬请谅解，希望收到您的反馈，联系邮箱：
      <a href="mailto:ycharsenal@163.com" className="underline underline-offset-2">
        ycharsenal@163.com
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
