"use client";

import { useActionState } from "react";
import { sendTestMailAction, type ActionState } from "@/lib/actions";

export default function MailTest({ defaultTo }: { defaultTo: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    sendTestMailAction,
    {}
  );

  return (
    <form action={formAction} className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          name="to"
          type="email"
          defaultValue={defaultTo}
          placeholder="收件邮箱"
          className="input !w-auto flex-1 !py-2 text-sm"
        />
        <button className="btn !px-4 !py-2 !text-sm" disabled={pending}>
          {pending ? "发送中…" : "发送自检邮件"}
        </button>
      </div>
      {state?.ok && (
        <p className="text-xs text-postblue">
          已提交给 Resend，请到收件箱（含垃圾箱）查看；若几分钟内未收到，多半是发信域名未验证，去 Resend 后台核对。
        </p>
      )}
      {state?.error && <p className="text-xs text-vermilion">{state.error}</p>}
    </form>
  );
}
