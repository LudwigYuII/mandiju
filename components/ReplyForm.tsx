"use client";
import { UiText, UiInput } from "@/components/UiText";

import { useActionState } from "react";
import { addReplyAction, type ActionState } from "@/lib/actions";

export default function ReplyForm({
  letterId,
  signedIn,
}: {
  letterId: string;
  signedIn: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    addReplyAction,
    {},
  );
  if (!signedIn)
    return (
      <p className="text-sm text-ink-soft">
        <UiText text={"登录后可以在信纸边缘批注。"} />
      </p>
    );
  return (
    <div>
      <form action={formAction} className="flex gap-2">
        <UiInput type="hidden" name="letterId" value={letterId} />
        <UiInput
          key={Number(state?.ok ?? 0)}
          name="body"
          className="input flex-1"
          placeholder="在信纸边缘批注…"
          maxLength={500}
        />
        <button className="btn !px-4 !py-2 !text-sm" disabled={pending}>
          <UiText text={"发送"} />
        </button>
      </form>
      {state?.error && (
        <p className="mt-1 text-xs text-vermilion">
          <UiText text={state.error} />
        </p>
      )}
    </div>
  );
}
