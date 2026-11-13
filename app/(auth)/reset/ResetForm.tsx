"use client";
import { UiText, UiInput } from "@/components/UiText";

import { useActionState } from "react";
import Link from "next/link";
import { resetPasswordAction, type ActionState } from "@/lib/actions";

export default function ResetForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    resetPasswordAction,
    {},
  );
  return (
    <form action={formAction} className="card glass space-y-4 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        <UiText text={"重置密码"} />
      </h1>
      <UiInput type="hidden" name="email" value={email} />
      <UiInput
        name="code"
        className="input"
        placeholder="6 位验证码"
        maxLength={6}
      />
      <UiInput
        name="password"
        type="password"
        className="input"
        placeholder="新密码（至少 6 位）"
      />
      {state?.error && (
        <p className="text-sm text-vermilion">
          <UiText text={state.error} />
        </p>
      )}
      <button className="btn w-full" disabled={pending}>
        <UiText text={pending ? "…" : "重置密码"} />
      </button>
      <p className="text-center text-sm text-ink-soft">
        <Link href="/login" className="text-vermilion">
          <UiText text={"返回登录"} />
        </Link>
      </p>
    </form>
  );
}
