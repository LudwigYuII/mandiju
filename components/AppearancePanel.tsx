"use client";

import { useEffect, useState } from "react";

const THEMES = [
  { id: "light", label: "浅色" },
  { id: "dark", label: "深色" },
  { id: "auto", label: "跟随系统" },
];

const FONTS = [
  { id: "default", label: "系统默认" },
  { id: "serif", label: "思源宋体" },
  { id: "sans", label: "思源黑体" },
  { id: "kai", label: "霞鹜文楷" },
  { id: "fang", label: "朱雀仿宋" },
];

export default function AppearancePanel() {
  const [theme, setTheme] = useState("auto");
  const [font, setFont] = useState("default");
  const [trad, setTrad] = useState(false);

  useEffect(() => {
    try {
      setTheme(localStorage.getItem("mdj-theme") || "auto");
      setFont(localStorage.getItem("mdj-font") || "default");
      setTrad(localStorage.getItem("mdj-trad") === "1");
    } catch {}
  }, []);

  const applyTheme = (t: string) => {
    setTheme(t);
    try {
      localStorage.setItem("mdj-theme", t);
    } catch {}
    const dark =
      t === "dark" ||
      (t === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  };

  useEffect(() => {
    if (theme !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const h = () => document.documentElement.classList.toggle("dark", mq.matches);
    h();
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, [theme]);

  const applyFont = (f: string) => {
    setFont(f);
    try {
      localStorage.setItem("mdj-font", f);
    } catch {}
    if (f === "default") document.documentElement.removeAttribute("data-font");
    else document.documentElement.setAttribute("data-font", f);
  };

  const applyTrad = (v: boolean) => {
    setTrad(v);
    try {
      localStorage.setItem("mdj-trad", v ? "1" : "0");
    } catch {}
    window.location.reload();
  };

  const seg = (items: { id: string; label: string }[], sel: string, onPick: (id: string) => void) => (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={() => onPick(it.id)}
          className={`btn-ghost !text-sm ${
            sel === it.id ? "!border-vermilion !text-vermilion" : ""
          }`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-ink-soft">主题</p>
        {seg(THEMES, theme, applyTheme)}
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-ink-soft">全站字体</p>
        {seg(FONTS, font, applyFont)}
        <p className="mt-1.5 text-xs text-ink-soft">官戳与私印始终使用楷体/仿宋，不受此项影响</p>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-ink-soft">简体 / 繁体</p>
        {seg(
          [
            { id: "0", label: "简体" },
            { id: "1", label: "繁体" },
          ],
          trad ? "1" : "0",
          (id) => applyTrad(id === "1")
        )}
        <p className="mt-1.5 text-xs text-ink-soft">切换后整站文字（含信件内容）随之转换</p>
      </div>
    </div>
  );
}
