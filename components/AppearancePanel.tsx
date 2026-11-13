"use client";
import { UiText } from "@/components/UiText";

import { useEffect, useState } from "react";
import { useLanguage } from "./LanguageProvider";

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
  const { locale, setLocale } = useLanguage();
  const trad = locale === "zh-Hant";

  useEffect(() => {
    try {
      setTheme(localStorage.getItem("mdj-theme") || "auto");
      setFont(localStorage.getItem("mdj-font") || "default");
    } catch {}
  }, []);

  const applyTheme = (t: string) => {
    setTheme(t);
    try {
      localStorage.setItem("mdj-theme", t);
    } catch {}
    const dark =
      t === "dark" ||
      (t === "auto" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  };

  useEffect(() => {
    if (theme !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const h = () =>
      document.documentElement.classList.toggle("dark", mq.matches);
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
    setLocale(v ? "zh-Hant" : "zh-Hans");
  };

  const seg = (
    items: { id: string; label: string }[],
    sel: string,
    onPick: (id: string) => void,
  ) => (
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
          <UiText text={it.label} />
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-ink-soft">
          <UiText text={"主题"} />
        </p>
        {seg(THEMES, theme, applyTheme)}
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-ink-soft">
          <UiText text={"全站字体"} />
        </p>
        {seg(FONTS, font, applyFont)}
        <p className="mt-1.5 text-xs text-ink-soft">
          <UiText text={"官戳与私印始终使用楷体/仿宋，不受此项影响"} />
        </p>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-ink-soft">
          <UiText text={"简体 / 繁体"} />
        </p>
        {seg(
          [
            { id: "0", label: "简体" },
            { id: "1", label: "繁体" },
          ],
          trad ? "1" : "0",
          (id) => applyTrad(id === "1"),
        )}
        <p className="mt-1.5 text-xs text-ink-soft">
          <UiText
            text={"切换界面文案，信件与作品保留作者原文；不会刷新页面。"}
          />
        </p>
      </div>
    </div>
  );
}
