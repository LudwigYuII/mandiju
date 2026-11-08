"use client";

import { useActionState } from "react";
import Link from "next/link";
import { resetPasswordAction, type ActionState } from "@/lib/actions";

export default function ResetForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(resetPasswordAction, {});
  return (
    <form action={formAction} className="card glass space-y-4 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">重置密码</h1>
      <input type="hidden" name="email" value={email} />
      <input name="code" className="input" placeholder="6 位验证码" maxLength={6} />
      <input name="password" type="password" className="input" placeholder="新密码（至少 6 位）" />
      {state?.error && <p className="text-sm text-vermilion">{state.error}</p>}
      <button className="btn w-full" disabled={pending}>
        {pending ? "…" : "重置密码"}
      </button>
      <p className="text-center text-sm text-ink-soft">
        <Link href="/login" className="text-vermilion">
          返回登录
        </Link>
      </p>
    </form>
  );
}
