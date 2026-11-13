"use client";
import { UiText, UiInput } from "@/components/UiText";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type ActionState } from "@/lib/actions";

export default function LoginForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    loginAction,
    {},
  );
  return (
    <form action={formAction} className="card glass space-y-4 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        <UiText text={"回局里"} />
      </h1>
      <UiInput name="email" type="email" className="input" placeholder="邮箱" />
      <UiInput
        name="password"
        type="password"
        className="input"
        placeholder="密码"
      />
      {state?.error && (
        <p className="text-sm text-vermilion">
          <UiText text={state.error} />
        </p>
      )}
      <button className="btn w-full" disabled={pending}>
        <UiText text={pending ? "…" : "登录"} />
      </button>
      <p className="text-center text-sm text-ink-soft">
        <UiText text={"还没有笔名？"} />
        <Link href="/register" className="text-vermilion">
          <UiText text={"凭邀请码注册"} />
        </Link>
      </p>
      <p className="text-center text-sm text-ink-soft">
        <Link href="/forgot" className="hover:text-ink">
          <UiText text={"忘记密码？"} />
        </Link>
      </p>
    </form>
  );
}
