"use client";
import { UiText, UiInput } from "@/components/UiText";

import { useActionState } from "react";
import { withdrawTopicAction, type ActionState } from "@/lib/actions";

export default function TopicWithdrawButton({ poolId }: { poolId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    withdrawTopicAction,
    {},
  );
  return (
    <form action={formAction}>
      <UiInput type="hidden" name="poolId" value={poolId} />
      <button
        className="rounded-full border border-black/10 px-2.5 py-1 text-xs text-ink-soft transition hover:border-vermilion/50 hover:text-vermilion dark:border-white/15"
        disabled={pending}
      >
        <UiText text={"撤回"} />
      </button>
      {state?.error && (
        <span className="ml-1 text-xs text-vermilion">
          <UiText text={state.error} />
        </span>
      )}
    </form>
  );
}
