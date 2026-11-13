"use client";

import { useEffect, useRef, useState } from "react";

function daysIn(y: number, m: number) {
  return new Date(y, m, 0).getDate();
}

/** 未来日期选择器（时光胶囊用）：年月日三列滚轮，自动钳制到未来 */
export default function FutureDatePicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string) => void;
}) {
  const now = new Date();
  const minY = now.getFullYear();
  const maxY = minY + 1;
  const years: number[] = [];
  for (let y = minY; y <= maxY; y++) years.push(y);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const [open, setOpen] = useState(false);
  const [y, setY] = useState(() => (value ? Number(value.slice(0, 4)) : minY));
  const [m, setM] = useState(() =>
    value ? Number(value.slice(5, 7)) : now.getMonth() + 1,
  );
  const [d, setD] = useState(() =>
    value ? Number(value.slice(8, 10)) : now.getDate() + 1,
  );
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const commit = (ny: number, nm: number, nd: number) => {
    let dt = new Date(ny, nm - 1, Math.min(nd, daysIn(ny, nm)));
    if (dt.getTime() <= Date.now()) {
      dt = new Date(now.getTime() + 24 * 3600 * 1000);
    }
    const yy = dt.getFullYear();
    const mm = dt.getMonth() + 1;
    const dd = dt.getDate();
    setY(yy);
    setM(mm);
    setD(dd);
    onChange(
      `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`,
    );
  };

  const wheel = (items: number[], sel: number, onPick: (n: number) => void) => (
    <div
      className="h-40 w-[68px] snap-y snap-mandatory overflow-y-auto overscroll-contain"
      style={{ scrollbarWidth: "none" }}
    >
      {items.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onPick(n)}
          className={`flex h-10 w-full snap-center items-center justify-center rounded-lg text-[15px] ${
            n === sel
              ? "bg-vermilion/10 font-semibold text-vermilion"
              : "text-ink-soft"
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
        <span>{value ? `${y} 年 ${m} 月 ${d} 日 解锁` : "选择解锁日期"}</span>
        <span className="text-ink-soft">⏳</span>
      </button>
      {open && (
        <div className="card glass absolute left-0 top-full z-30 mt-2 flex gap-2 p-3 shadow-lg">
          {wheel(years, y, (n) => commit(n, m, d))}
          {wheel(months, m, (n) => commit(y, n, d))}
          {wheel(
            Array.from({ length: daysIn(y, m) }, (_, i) => i + 1),
            d,
            (n) => commit(y, m, n),
          )}
        </div>
      )}
    </div>
  );
}
