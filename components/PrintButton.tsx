"use client";
import { UiText } from "@/components/UiText";

export default function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn !px-5 !py-2 !text-sm">
      <UiText text={"打印 / 存为 PDF"} />
    </button>
  );
}
