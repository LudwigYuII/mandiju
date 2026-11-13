"use client";
import { UiText, UiInput } from "@/components/UiText";

import { useActionState, useState } from "react";
import { updateSealAction, type ActionState } from "@/lib/actions";
import Seal from "./Seal";

export default function SealEditor({ current }: { current: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateSealAction,
    {},
  );
  const [seal, setSeal] = useState(current);

  return (
    <form action={formAction} className="mt-2 flex items-center gap-3">
      <UiInput
        name="seal"
        className="input w-24 text-center !text-lg"
        maxLength={2}
        value={seal}
        onChange={(e) => setSeal(e.target.value)}
      />
      <Seal char={seal || "印"} size={44} />
      <button className="btn !px-4 !py-2 !text-sm" disabled={pending}>
        <UiText text={"保存"} />
      </button>
      {state?.error && (
        <p className="text-xs text-vermilion">
          <UiText text={state.error} />
        </p>
      )}
      {state?.ok && (
        <p className="text-xs text-postblue">
          <UiText text={"已更新"} />
        </p>
      )}
    </form>
  );
}
