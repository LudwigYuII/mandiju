"use client";
import { UiText, UiInput } from "@/components/UiText";

import { useActionState, useState } from "react";
import Link from "next/link";
import { forgotPasswordAction, type ActionState } from "@/lib/actions";

export default function ForgotForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    forgotPasswordAction,
    {},
  );
  const [email, setEmail] = useState("");
  return (
    <form action={formAction} className="card glass space-y-4 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        <UiText text={"找回密码"} />
      </h1>
      {state?.ok ? (
        <p className="text-sm text-postblue">
          <UiText
            text={
              "验证码已发送到你的邮箱（开发阶段可在服务器日志查看 [MAIL] 输出），15 分钟内有效。"
            }
          />{" "}
          <Link
            href={`/reset?email=${encodeURIComponent(email)}`}
            className="text-vermilion"
          >
            <UiText text={"去重置 →"} />
          </Link>
        </p>
      ) : (
        <>
          <UiInput
            name="email"
            type="email"
            className="input"
            placeholder="注册邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {state?.error && (
            <p className="text-sm text-vermilion">
              <UiText text={state.error} />
            </p>
          )}
          <button className="btn w-full" disabled={pending}>
            <UiText text={pending ? "…" : "发送验证码"} />
          </button>
        </>
      )}
      <p className="text-center text-sm text-ink-soft">
        <UiText text={"想起来了？"} />
        <Link href="/login" className="text-vermilion">
          <UiText text={"回去登录"} />
        </Link>
      </p>
    </form>
  );
}
