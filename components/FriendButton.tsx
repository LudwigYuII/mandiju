"use client";
import { UiText, UiInput } from "@/components/UiText";

import Link from "next/link";
import { useActionState } from "react";
import { sendFriendRequestAction, type ActionState } from "@/lib/actions";

/**
 * 加笔友按钮：按当前关系渲染
 * - none → 加为笔友
 * - pending_out → 已寄出申请
 * - pending_in → 去接受申请
 * - friends → 写信
 */
export default function FriendButton({
  targetId,
  pen,
  rel,
}: {
  targetId: string;
  pen: string;
  rel: "none" | "pending_out" | "pending_in" | "friends";
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    sendFriendRequestAction,
    {},
  );

  if (state?.ok) {
    return (
      <span className="btn-ghost !px-4 !py-1.5 !text-sm opacity-60">
        <UiText text={"✉️ 已寄出申请"} />
      </span>
    );
  }

  if (rel === "friends") {
    return (
      <Link
        href={`/write?to=${encodeURIComponent(pen)}`}
        className="btn !px-4 !py-1.5 !text-sm"
      >
        <UiText text={"写信"} />
      </Link>
    );
  }
  if (rel === "pending_out") {
    return (
      <span className="btn-ghost !px-4 !py-1.5 !text-sm opacity-60">
        <UiText text={"✉️ 已寄出申请"} />
      </span>
    );
  }
  if (rel === "pending_in") {
    return (
      <Link href="/friends" className="btn !px-4 !py-1.5 !text-sm">
        <UiText text={"✉️ 去接受申请"} />
      </Link>
    );
  }
  return (
    <form action={formAction}>
      <UiInput type="hidden" name="targetId" value={targetId} />
      <button className="btn !px-4 !py-1.5 !text-sm" disabled={pending}>
        <UiText text={pending ? "寄出中…" : "加为笔友"} />
      </button>
      {state?.error && (
        <p className="mt-1 text-right text-xs text-vermilion">
          <UiText text={state.error} />
        </p>
      )}
    </form>
  );
}
