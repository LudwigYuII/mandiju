"use client";

export default function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn !px-5 !py-2 !text-sm">
      打印 / 存为 PDF
    </button>
  );
}
