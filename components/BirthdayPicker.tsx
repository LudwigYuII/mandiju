"use client";
import { useState } from "react";
export default function BirthdayPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string) => void;
}) {
  const parts = (value || "").split("-");
  const initial = parts.length === 3 ? parts.slice(1) : parts;
  const [month, setMonth] = useState(initial[0] || "");
  const [day, setDay] = useState(initial[1] || "");
  const save = (m: string, d: string) => {
    setMonth(m);
    setDay(d);
    onChange(m && d ? `${m}-${d}` : "");
  };
  return (
    <div className="flex gap-2">
      <select
        aria-label="生辰月份"
        className="input"
        value={month}
        onChange={(e) => save(e.target.value, "")}
      >
        <option value="">不填写</option>
        {Array.from({ length: 12 }, (_, i) =>
          String(i + 1).padStart(2, "0"),
        ).map((m) => (
          <option key={m} value={m}>
            {m}月
          </option>
        ))}
      </select>
      <select
        aria-label="生辰日期"
        className="input"
        value={day}
        onChange={(e) => save(month, e.target.value)}
      >
        <option value="">日期</option>
        {Array.from(
          { length: month ? new Date(2000, Number(month), 0).getDate() : 0 },
          (_, i) => String(i + 1).padStart(2, "0"),
        ).map((d) => (
          <option key={d} value={d}>
            {d}日
          </option>
        ))}
      </select>
    </div>
  );
}
