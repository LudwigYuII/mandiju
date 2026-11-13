"use client";
import { useId, useState } from "react";
import { annotationParts } from "@/lib/literary-policy";
import { UiText } from "./UiText";
export default function AnnotatedText({ text }: { text: string }) {
  const id = useId(),
    [open, setOpen] = useState<number | null>(null);
  return (
    <span className="whitespace-pre-wrap break-words">
      {annotationParts(text).map((p, i) =>
        p.note ? (
          <span
            key={i}
            className="literary-annotation"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(null);
                e.stopPropagation();
              }
            }}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) setOpen(null);
            }}
          >
            <button
              type="button"
              className="border-b border-dotted border-current text-inherit"
              aria-expanded={open === i}
              aria-controls={`${id}-${i}`}
              aria-describedby={open === i ? `${id}-${i}` : undefined}
              onFocus={() => setOpen(i)}
              onClick={() => setOpen(i)}
            >
              {p.text}
            </button>
            {open === i && (
              <span id={`${id}-${i}`} role="note" className="literary-note">
                <span>{p.note}</span>
                <button
                  type="button"
                  className="mt-2 block text-xs underline underline-offset-4"
                  onClick={() => setOpen(null)}
                >
                  <UiText text="收起自注" />
                </button>
              </span>
            )}
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </span>
  );
}
