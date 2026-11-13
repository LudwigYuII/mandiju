"use client";
import { UiText, UiInput } from "@/components/UiText";

import { useActionState } from "react";
import { sendTestMailAction, type ActionState } from "@/lib/actions";

/**
 * 邮件通道自检 + 状态提示（站长后台用）。
 * 注意：configured 只是「服务端有没有配 RESEND_API_KEY」的布尔值，
 * 绝不能把 key 或 key 片段传到客户端。
 */
export default function MailTest({
  defaultTo,
  configured,
}: {
  defaultTo: string;
  configured: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    sendTestMailAction,
    {},
  );

  return (
    <div className="mt-3 space-y-3">
      <p className="text-xs">
        <span className="text-ink-soft">
          <UiText text={"当前状态："} />
        </span>
        <span
          className={
            configured
              ? "font-semibold text-postblue"
              : "font-semibold text-vermilion"
          }
        >
          <UiText
            text={
              configured
                ? "已配置（RESEND_API_KEY 已设置）"
                : "未配置（未设置 RESEND_API_KEY，邮件只会写进服务器日志）"
            }
          />
        </span>
      </p>

      {!configured && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-3.5 py-3 text-xs leading-relaxed text-ink-soft">
          <p className="font-semibold text-ink">
            <UiText text={"开通步骤（大约 10 分钟）"} />
          </p>
          <ol className="mt-1.5 list-inside list-decimal space-y-1">
            <li>
              <UiText text={"打开"} />{" "}
              <a
                href="https://resend.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-vermilion hover:underline"
              >
                resend.com
              </a>{" "}
              <UiText text={"注册（免费额度够小站用）。"} />
            </li>
            <li>
              <UiText text={"Resend 后台 → Domains → 添加"} />
              <span className="font-mono">ludwig.uno</span>
              <UiText
                text={
                  "，按提示到域名 DNS 加 SPF / DKIM 记录，等状态变成 Verified（验证发信域名，否则只能发到自己的注册邮箱）。"
                }
              />
            </li>
            <li>
              <UiText
                text={
                  "Resend → API Keys → Create API Key（权限选 Sending access），复制"
                }
              />{" "}
              <span className="font-mono">re_</span>
              <UiText text={"开头的 key。"} />
            </li>
            <li>
              <UiText
                text={"Vercel 项目 → Settings → Environment Variables 添加："}
              />
              <span className="font-mono">RESEND_API_KEY</span>
              <UiText text={"（上一步的 key）与"} />{" "}
              <span className="font-mono">MAIL_FROM</span>
              <UiText text={"（例如"} />{" "}
              <span className="font-mono">
                <UiText text={"慢递局 &lt;letters@ludwig.uno&gt;"} />
              </span>
              <UiText text={"，域名须与已验证域名一致）。"} />
            </li>
            <li>
              <UiText
                text={
                  "重新部署（Redeploy）后回到本页发一封自检邮件确认收得到。"
                }
              />
            </li>
          </ol>
        </div>
      )}

      <form action={formAction} className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <UiInput
            name="to"
            type="email"
            defaultValue={defaultTo}
            placeholder="收件邮箱"
            className="input !w-auto flex-1 !py-2 text-sm"
          />
          <button className="btn !px-4 !py-2 !text-sm" disabled={pending}>
            <UiText text={pending ? "发送中…" : "发送自检邮件"} />
          </button>
        </div>
        {state?.ok && (
          <p className="text-xs text-postblue">
            <UiText
              text={
                "已提交给 Resend，请到收件箱（含垃圾箱）查看；若几分钟内未收到，多半是发信域名未验证，去 Resend 后台核对 Domains 状态。"
              }
            />
          </p>
        )}
        {state?.error && (
          <p className="text-xs text-vermilion">
            <UiText text={state.error} />
          </p>
        )}
      </form>
    </div>
  );
}
