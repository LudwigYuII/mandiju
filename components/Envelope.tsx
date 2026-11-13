"use client";
import { UiText } from "@/components/UiText";

import { useState } from "react";
import Seal, {
  sealToneOf,
  sealPatternOf,
  sealToneToRender,
  type LetterSealTone,
  type SealPattern,
} from "./Seal";
export default function Envelope({
  letterId,
  seal,
  children,
  sealColor,
  sealPattern,
}: {
  letterId: string;
  seal: string;
  children: React.ReactNode;
  sealColor?: LetterSealTone | string | null;
  sealPattern?: SealPattern | string | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="letter-envelope"
    >
      <summary className="cursor-pointer rounded-lg border border-black/10 p-5 focus-visible:outline dark:border-white/10">
        <span className="inline-flex items-center gap-4">
          <Seal
            char={seal}
            size={36}
            tone={sealToneToRender(sealToneOf(sealColor))}
            pattern={sealPatternOf(sealPattern)}
          />
          <span>
            <UiText text={open ? "合起信笺" : "启封展读"} />
          </span>
        </span>
      </summary>
      <div className="pt-5">{children}</div>
    </details>
  );
}
export function rustle() {
  /* Sound is not forced on readers. */
}
