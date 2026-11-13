"use client";
import { UiText, UiInput } from "@/components/UiText";

import { useActionState } from "react";
import { generateInvitesAction, type ActionState } from "@/lib/actions";

export default function GenerateInvites() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    generateInvitesAction,
    {},
  );
  return (
    <form action={formAction} className="mt-3 flex items-center gap-2">
      <UiInput type="hidden" name="count" value="5" />
      <button className="btn !px-4 !py-2 !text-sm" disabled={pending}>
        <UiText text={pending ? "生成中…" : "生成 5 枚邀请码"} />
      </button>
      {state?.error && (
        <p className="text-xs text-vermilion">
          <UiText text={state.error} />
        </p>
      )}
      {state?.ok && (
        <p className="text-xs text-postblue">
          <UiText text={"已生成，见下方清单"} />
        </p>
      )}
    </form>
  );
}
