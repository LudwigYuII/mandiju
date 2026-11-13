"use client";
import { UiText, UiInput } from "@/components/UiText";

import { useActionState, useState } from "react";
import BirthdayPicker from "./BirthdayPicker";
import { updateBirthdayAction, type ActionState } from "@/lib/actions";

export default function BirthdayEditor({
  current,
}: {
  current: string | null;
}) {
  const [b, setB] = useState<string | null>(current);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateBirthdayAction,
    {},
  );
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <div className="w-60">
        <BirthdayPicker value={b} onChange={setB} />
      </div>
      <UiInput type="hidden" name="birthday" value={b ?? ""} />
      <button className="btn !px-4 !py-2 !text-sm" disabled={pending}>
        <UiText text={pending ? "保存中…" : "保存"} />
      </button>
      {state?.ok && (
        <span className="text-xs text-postblue">
          <UiText text={"已保存 ✓"} />
        </span>
      )}
      {state?.error && (
        <span className="text-xs text-vermilion">
          <UiText text={state.error} />
        </span>
      )}
    </form>
  );
}
