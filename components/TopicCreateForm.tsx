"use client";
import { UiText, UiInput } from "@/components/UiText";

import { useActionState, useState } from "react";
import { createTopicAction, type ActionState } from "@/lib/actions";

export default function TopicCreateForm({
  pool,
}: {
  pool: { id: string; title: string }[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createTopicAction,
    {},
  );
  const [custom, setCustom] = useState(false);
  return (
    <form action={formAction} className="space-y-3">
      {custom ? (
        <UiInput
          name="title"
          className="input"
          placeholder="自己出一道题"
          maxLength={40}
        />
      ) : (
        <div className="space-y-2">
          {pool.map((p) => (
            <label
              key={p.id}
              className="flex items-center gap-2 rounded-xl border border-black/5 px-3 py-2.5 dark:border-white/10"
            >
              <UiInput
                type="radio"
                name="poolId"
                value={p.id}
                className="accent-[var(--vermilion)]"
              />
              <span className="text-sm">{p.title}</span>
            </label>
          ))}
          <button
            type="button"
            onClick={() => setCustom(true)}
            className="btn-ghost !px-4 !py-2 !text-sm"
          >
            <UiText text={"自己出一道"} />
          </button>
        </div>
      )}
      {state?.error && (
        <p className="text-xs text-vermilion">
          <UiText text={state.error} />
        </p>
      )}
      {state?.ok && (
        <p className="text-xs text-postblue">
          <UiText text={"本月主题已挂出"} />
        </p>
      )}
      <button className="btn !px-5 !py-2.5 !text-sm" disabled={pending}>
        <UiText text={"挂出本月主题"} />
      </button>
    </form>
  );
}
