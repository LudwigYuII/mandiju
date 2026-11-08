"use client";

import { useActionState } from "react";
import { addNoteAction, type ActionState } from "@/lib/actions";

export default function NoteForm({ signedIn }: { signedIn: boolean }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(addNoteAction, {});
  if (!signedIn) return null;
  return (
    <form action={formAction} className="mt-3 flex items-start gap-2">
      <input name="body" className="input flex-1" placeholder="在墙上贴一张便签…" maxLength={120} />
      <button className="btn !px-4 !py-2 !text-sm" disabled={pending}>
        贴上
      </button>
      {state?.error && <p className="mt-1 text-xs text-vermilion">{state.error}</p>}
    </form>
  );
}
