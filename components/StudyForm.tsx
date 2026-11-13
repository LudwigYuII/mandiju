"use client";
import { useActionState } from "react";
import { studyAction } from "@/lib/study-actions";
import { UiText } from "./UiText";
import type { ReactNode } from "react";
export default function StudyForm({
  op,
  fields = {},
  label,
  children,
  caution = false,
}: {
  op: string;
  fields?: Record<string, string>;
  label: string;
  children?: ReactNode;
  caution?: boolean;
}) {
  const [state, action, pending] = useActionState(studyAction, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="op" value={op} />
      {Object.entries(fields).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      {children}
      <button
        disabled={pending}
        className={caution ? "btn-ghost text-sm" : "btn text-sm"}
      >
        <UiText text={pending ? "正在保存…" : label} />
      </button>
      <p role="status" aria-live="polite" className="text-sm text-ink-soft">
        <UiText text={state.error || (state.ok ? "已保存。" : "")} />
      </p>
    </form>
  );
}
