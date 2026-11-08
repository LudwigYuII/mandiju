"use client";

import { useEffect, useRef, useState } from "react";

const NOW_YEAR = new Date().getFullYear();
const YEARS: number[] = [];
for (let y = NOW_YEAR; y >= 1930; y--) YEARS.push(y);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

function daysIn(y: number, m: number) {
  return new Date(y, m, 0).getDate();
}

export default function BirthdayPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [y, setY] = useState(() => (value ? Number(value.slice(0, 4)) : 2000));
  const [m, setM] = useState(() => (value ? Number(value.slice(5, 7)) : 1));
  const [d, setD] = useState(() => (value ? Number(value.slice(8, 10)) : 1));
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const commit = (ny: number, nm: number, nd: number) => {
    const dd = Math.min(nd, daysIn(ny, nm));
    setY(ny);
    setM(nm);
    setD(dd);
    onChange(`${ny}-${String(nm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`);
  };

  const wheel = (items: number[], sel: number, onPick: (n: number) => void) => (
    <div
      className="h-44 w-[68px] snap-y snap-mandatory overflow-y-auto overscroll-contain"
      style={{ scrollbarWidth: "none" }}
    >
      {items.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onPick(n)}
          className={`flex h-10 w-full snap-center items-center justify-center rounded-lg text-[15px] ${
            n === sel ? "bg-vermilion/10 font-semibold text-vermilion" : "text-ink-soft"
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );

  return (
    <div className="relative" ref={wrap}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="input flex items-center justify-between !text-[15px]"
      >
        <span>{value ? `${y} 年 ${m} 月 ${d} 日` : "请选择"}</span>
        <span className="text-ink-soft">📅</span>
      </button>
      {open && (
        <div className="card glass absolute left-0 top-full z-30 mt-2 flex gap-2 p-3 shadow-lg">
          {wheel(YEARS, y, (n) => commit(n, m, d))}
          {wheel(MONTHS, m, (n) => commit(y, n, d))}
          {wheel(
            Array.from({ length: daysIn(y, m) }, (_, i) => i + 1),
            d,
            (n) => commit(y, m, n)
          )}
        </div>
      )}
    </div>
  );
}
