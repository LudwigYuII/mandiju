"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { literaryAction } from "@/lib/literary-actions";
import { UiText } from "./UiText";
import type { ReactNode } from "react";
export default function LiteraryForm({
  op,
  fields = {},
  label,
  children,
  draftKey,
}: {
  op: string;
  fields?: Record<string, string>;
  label: string;
  children?: ReactNode;
  draftKey?: string;
}) {
  const [state, action, pending] = useActionState(literaryAction, {}),
    ref = useRef<HTMLFormElement>(null);
  const [hasDraft, setHasDraft] = useState(false),
    [saved, setSaved] = useState(false);
  const key = draftKey ? `mdj-literary-v1:${draftKey}` : null;
  useEffect(() => {
    try {
      setHasDraft(!!key && !!sessionStorage.getItem(key));
    } catch {}
  }, [key]);
  function restore() {
    if (!key || !ref.current) return;
    try {
      const d = JSON.parse(sessionStorage.getItem(key) || "{}");
      for (const name of ["title", "body", "intro", "rhyme", "work_title"]) {
        const field = ref.current.elements.namedItem(name);
        if (
          (field instanceof HTMLInputElement ||
            field instanceof HTMLTextAreaElement) &&
          typeof d[name] === "string"
        )
          field.value = d[name];
      }
      setHasDraft(false);
    } catch {}
  }
  useEffect(() => {
    if (state.ok && key) {
      try {
        sessionStorage.removeItem(key);
      } catch {}
      setHasDraft(false);
      setSaved(false);
    }
    if (state.error && key) restore();
    // Restoring is tied to a completed action, not every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, key]);
  function saveDraft() {
    if (!key || !ref.current) return;
    try {
      const data = new FormData(ref.current),
        draft: Record<string, string> = {};
      for (const name of ["title", "body", "intro", "rhyme", "work_title"]) {
        const v = data.get(name);
        if (typeof v === "string") draft[name] = v;
      }
      sessionStorage.setItem(key, JSON.stringify(draft));
      setSaved(true);
    } catch {}
  }
  return (
    <form ref={ref} action={action} onInput={saveDraft} className="space-y-4">
      <input type="hidden" name="op" value={op} />
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {hasDraft && (
        <button type="button" className="btn-ghost text-sm" onClick={restore}>
          <UiText text="恢复此标签页的未完草稿" />
        </button>
      )}
      {children}
      <button disabled={pending} className="btn text-sm">
        <UiText text={pending ? "正在保存…" : label} />
      </button>
      {key && (
        <p className="text-xs text-ink-soft">
          <UiText
            text={
              saved
                ? "文字已暂存于本浏览器标签页；关闭标签页后可能清除。"
                : "写作时会在本浏览器标签页暂存文字。"
            }
          />
        </p>
      )}
      <p role="status" aria-live="polite" className="text-sm text-ink-soft">
        <UiText text={state.error || (state.ok ? "已保存。" : "")} />
      </p>
    </form>
  );
}
