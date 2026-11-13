"use client";
import { UiText, UiInput } from "@/components/UiText";

import { useActionState } from "react";
import { proposeTopicAction, type ActionState } from "@/lib/actions";

export default function TopicProposeForm({ signedIn }: { signedIn: boolean }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    proposeTopicAction,
    {},
  );
  if (!signedIn) return null;
  return (
    <div>
      <form action={formAction} className="flex gap-2">
        <UiInput
          key={Number(state?.ok ?? 0)}
          name="title"
          className="input flex-1"
          placeholder="一句话选题，投进题池"
          maxLength={40}
        />
        <button className="btn !px-4 !py-2 !text-sm" disabled={pending}>
          <UiText text={"投题"} />
        </button>
      </form>
      {state?.error && (
        <p className="mt-1 text-xs text-vermilion">
          <UiText text={state.error} />
        </p>
      )}
      {state?.ok && (
        <p className="mt-1 text-xs text-postblue">
          <UiText text={"已投进题池，等邮差来选"} />
        </p>
      )}
    </div>
  );
}
