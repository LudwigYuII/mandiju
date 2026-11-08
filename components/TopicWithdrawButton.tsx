"use client";

import { useActionState } from "react";
import { withdrawTopicAction, type ActionState } from "@/lib/actions";

export default function TopicWithdrawButton({ poolId }: { poolId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    withdrawTopicAction,
    {}
  );
  return (
    <form action={formAction}>
      <input type="hidden" name="poolId" value={poolId} />
      <button
        className="rounded-full border border-black/10 px-2.5 py-1 text-xs text-ink-soft transition hover:border-vermilion/50 hover:text-vermilion dark:border-white/15"
        disabled={pending}
      >
        撤回
      </button>
      {state?.error && <span className="ml-1 text-xs text-vermilion">{state.error}</span>}
    </form>
  );
}
