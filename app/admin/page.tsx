import { UiText, UiInput } from "@/components/UiText";

import Link from "next/link";
import { redirect } from "next/navigation";
import { db, waitDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { fmtTime } from "@/lib/delivery";
import { getHealthReport } from "@/lib/health";
import {
  adminDeleteLetterAction,
  adminToggleBanAction,
  adminToggleRoleAction,
  createAnnouncementAction,
  deleteAnnouncementAction,
} from "@/lib/actions";
import GenerateInvites from "@/components/GenerateInvites";
import MailTest from "@/components/MailTest";
import Reveal from "@/components/Reveal";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await waitDb();
  const sess = await getSession();
  if (!sess) redirect("/login");
  const me = (
    await db.execute({
      sql: "SELECT role, email FROM users WHERE id=?",
      args: [sess.uid],
    })
  ).rows[0] as any;
  if (String(me?.role) !== "admin") redirect("/");

  const [users, stats, letters, announcements, invites, pool, health] =
    await Promise.all([
      db.execute(
        "SELECT id, pen_name, email, role, banned, letters_sent, coins, created_at FROM users ORDER BY created_at ASC",
      ),
      Promise.all([
        db.execute("SELECT COUNT(*) AS n FROM users"),
        db.execute("SELECT COUNT(*) AS n FROM letters"),
        db.execute(
          "SELECT COUNT(*) AS n FROM letters WHERE recipient_id IS NULL",
        ),
        db.execute("SELECT COUNT(*) AS n FROM likes"),
        db.execute("SELECT COUNT(*) AS n FROM replies"),
        db.execute("SELECT COUNT(*) AS n FROM invites WHERE used_by IS NULL"),
      ]),
      db.execute(`SELECT l.id, l.title, l.genre, l.deliver_at, l.recipient_id, l.burn_seconds, l.burned, u.pen_name
                FROM letters l JOIN users u ON u.id = l.author_id
                WHERE l.recipient_id IS NULL ORDER BY l.sent_at DESC LIMIT 20`),
      db.execute(
        "SELECT * FROM announcements ORDER BY pinned DESC, created_at DESC LIMIT 20",
      ),
      db.execute(`SELECT i.code, i.created_at, i.used_by, uu.pen_name AS used_by_pen
                FROM invites i LEFT JOIN users uu ON uu.id = i.used_by
                ORDER BY i.created_at DESC LIMIT 50`),
      db.execute("SELECT COUNT(*) AS n FROM topic_pool WHERE status='pending'"),
      getHealthReport(),
    ]);

  const stat = {
    users: Number((stats[0] as any).rows[0]?.n ?? 0),
    letters: Number((stats[1] as any).rows[0]?.n ?? 0),
    publicLetters: Number((stats[2] as any).rows[0]?.n ?? 0),
    likes: Number((stats[3] as any).rows[0]?.n ?? 0),
    replies: Number((stats[4] as any).rows[0]?.n ?? 0),
    invites: Number((stats[5] as any).rows[0]?.n ?? 0),
    pendingTopics: Number(pool.rows[0]?.n ?? 0),
  };

  const cards = [
    { label: "局友", value: stat.users },
    { label: "信件", value: stat.letters },
    { label: "公开信", value: stat.publicLetters },
    { label: "贴邮票", value: stat.likes },
    { label: "批注", value: stat.replies },
    { label: "待用邀请码", value: stat.invites },
  ];

  // 系统状态卡：数据来自 lib/health.ts（与 /api/health 同一份），只含布尔与计数
  const cfg = health.config;
  const counts = health.db.counts;
  type Tone = "ok" | "warn" | "muted";
  const TONE: Record<Tone, string> = {
    ok: "bg-postblue/10 text-postblue",
    warn: "bg-vermilion/15 text-vermilion",
    muted: "border border-black/10 text-ink-soft dark:border-white/15",
  };
  const missingVapid = [
    !cfg.vapid.public && "public",
    !cfg.vapid.private && "private",
  ]
    .filter(Boolean)
    .join(" / ");
  const statusItems: {
    name: string;
    label: string;
    tone: Tone;
    detail: string;
  }[] = [
    {
      name: "数据库",
      label: health.db.ok ? "正常" : "异常",
      tone: health.db.ok ? "ok" : "warn",
      detail: health.db.ok
        ? `${health.db.remote ? "远程 Turso" : "本地文件"} · 查询往返 ${health.db.ms ?? "?"}ms` +
          (counts
            ? ` · 局友 ${counts.users} 位 / 信件 ${counts.letters} 封 / 通知 ${counts.notifications} 条 / 推送订阅 ${counts.pushSubs} 个`
            : "")
        : "连接失败：核对 Vercel 上的 MDJ_DB / MDJ_DB_AUTH_TOKEN 与 Turso 控制台状态；详细错误见服务器日志。",
    },
    {
      name: "邮件",
      label: cfg.mail ? "已配置" : "未配置",
      tone: cfg.mail ? "ok" : "warn",
      detail: cfg.mail
        ? `Resend 已就绪${cfg.mailFrom ? "" : "（未设 MAIL_FROM，发件人用默认 letters@ludwig.uno）"}；来信送达 / 找回密码 / 生日问候会发邮件。`
        : "未配置：在 Vercel 环境变量加 RESEND_API_KEY 与 MAIL_FROM —— 申请步骤见下方「邮件通道」卡片；未配置时邮件只写日志，站内写信不受影响。",
    },
    {
      name: "推送",
      label: cfg.push ? "已配置" : "未配置",
      tone: cfg.push ? "ok" : "warn",
      detail: cfg.push
        ? "VAPID 密钥已就绪，新信送达会发 Web Push。"
        : `未配置：在 Vercel 加 MDJ_VAPID_PUBLIC / MDJ_VAPID_PRIVATE（缺 ${missingVapid || "两项"}），可用 npx web-push generate-vapid-keys 生成。`,
    },
    {
      name: "对象存储",
      label: cfg.r2 ? "已配置" : "未配置",
      tone: cfg.r2 ? "ok" : "warn",
      detail: cfg.r2
        ? "Cloudflare R2 已就绪，头像与照片走对象存储。"
        : "未配置：加 R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET / R2_PUBLIC_URL；未配置时图片落本地磁盘，Vercel 上重启即丢。",
    },
    {
      name: "站长密码",
      label: cfg.adminPass ? "已配置" : "默认密码",
      tone: cfg.adminPass ? "ok" : "warn",
      detail: cfg.adminPass
        ? "MDJ_ADMIN_PASS 已设置。"
        : "未设置 MDJ_ADMIN_PASS，正在使用代码内置默认密码，请立刻在 Vercel 补上。",
    },
    {
      name: "运维密钥",
      label: cfg.secret && cfg.dbAuthToken ? "已配置" : "缺项",
      tone: cfg.secret && cfg.dbAuthToken ? "ok" : "warn",
      detail: `MDJ_SECRET ${cfg.secret ? "已设置" : "未设置（会话签名走开发默认值，务必配置）"} · MDJ_DB_AUTH_TOKEN ${
        cfg.dbAuthToken ? "已设置" : "未设置"
      }。`,
    },
    {
      name: "定时任务",
      label: health.cron.lastRunAt ? "已记录" : "未记录",
      tone: "muted",
      detail: `${health.cron.scheduleBeijing} 执行（vercel.json：${health.cron.schedule} UTC）· 最近一次执行：${
        health.cron.lastRunAt ?? "未落库，无法回看"
      }。${health.cron.note}`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="rise text-3xl font-semibold tracking-tight">
          <UiText text={"邮务总办"} />
        </h1>
        <span className="text-xs text-ink-soft">
          <UiText text={"站长后台 ·"} />
          {sess.pen}
        </span>
      </div>

      {/* 看板 */}
      <Reveal>
        <section className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
          {cards.map((c) => (
            <div key={c.label} className="card glass p-3.5 text-center">
              <div className="text-2xl font-semibold text-vermilion">
                {c.value}
              </div>
              <div className="mt-0.5 text-xs text-ink-soft">
                <UiText text={c.label} />
              </div>
            </div>
          ))}
        </section>
      </Reveal>

      {/* 系统状态 */}
      <Reveal delay={40}>
        <section className="card glass p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold tracking-widest">
              <UiText text={"系统状态"} />
            </h2>
            <span
              className={`text-xs ${health.ok ? "text-postblue" : "font-semibold text-vermilion"}`}
            >
              <UiText text={health.ok ? "运行正常" : "⚠ 存在异常，请检查"} />
              <UiText text={"· 采集于"} />{" "}
              {fmtTime(new Date(health.time).getTime())}
            </span>
          </div>
          <ul className="mt-3 space-y-1.5">
            {statusItems.map((it) => (
              <li
                key={it.name}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-black/5 px-3 py-2 text-sm dark:border-white/10"
              >
                <span className="w-14 shrink-0 text-ink-soft">{it.name}</span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${TONE[it.tone]}`}
                >
                  <UiText text={it.label} />
                </span>
                <span className="min-w-0 flex-1 text-xs leading-relaxed text-ink-soft">
                  {it.detail}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2.5 text-xs text-ink-soft">
            <UiText text={"同一份数据也见于"} />{" "}
            <a
              href="/api/health"
              target="_blank"
              rel="noopener noreferrer"
              className="text-vermilion hover:underline"
            >
              /api/health
            </a>
            <UiText text={"（无需登录，只含状态与计数，不含任何密钥值）"} />
            {health.build.commit
              ? ` · 当前部署版本 ${health.build.commit}`
              : ""}
            。
          </p>
        </section>
      </Reveal>

      {/* 公告 */}
      <Reveal delay={60}>
        <section className="card glass p-5">
          <h2 className="text-sm font-semibold tracking-widest">
            <UiText text={"公告"} />
          </h2>
          <p className="mt-1 text-xs text-ink-soft">
            <UiText text={"发布后会出现在所有局友的首页。"} />
          </p>
          <form
            action={async (fd: FormData) => {
              "use server";
              await createAnnouncementAction({}, fd);
            }}
            className="mt-3 flex flex-col gap-2 sm:flex-row"
          >
            <UiInput
              name="body"
              className="input flex-1"
              placeholder="公告内容（最多 200 字）"
              maxLength={200}
            />
            <label className="flex shrink-0 items-center gap-1.5 text-sm text-ink-soft">
              <UiInput type="checkbox" name="pinned" value="1" />
              <UiText text={"置顶"} />
            </label>
            <button className="btn shrink-0 !px-5">
              <UiText text={"发布"} />
            </button>
          </form>
          {announcements.rows.length > 0 && (
            <ul className="mt-3 space-y-2">
              {announcements.rows.map((a: any) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-black/5 px-3 py-2 text-sm dark:border-white/10"
                >
                  <span className="min-w-0 flex-1">
                    {Number(a.pinned) === 1 && (
                      <span className="mr-1.5 text-vermilion">📌</span>
                    )}
                    {String(a.body)}
                    <span className="ml-2 text-xs text-ink-soft">
                      {fmtTime(Number(a.created_at))}
                    </span>
                  </span>
                  <form action={deleteAnnouncementAction}>
                    <UiInput type="hidden" name="id" value={String(a.id)} />
                    <button className="btn-ghost !px-3 !py-1 !text-xs">
                      <UiText text={"撤下"} />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </Reveal>

      {/* 局友管理 */}
      <Reveal delay={100}>
        <section className="card glass p-5">
          <h2 className="text-sm font-semibold tracking-widest">
            <UiText text={"局友（"} />
            {stat.users}）
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-soft">
                  <th className="pb-2 font-normal">
                    <UiText text={"笔名"} />
                  </th>
                  <th className="pb-2 font-normal">
                    <UiText text={"邮箱"} />
                  </th>
                  <th className="pb-2 font-normal">
                    <UiText text={"寄出"} />
                  </th>
                  <th className="pb-2 font-normal">
                    <UiText text={"身份"} />
                  </th>
                  <th className="pb-2 font-normal">
                    <UiText text={"入局"} />
                  </th>
                  <th className="pb-2 text-right font-normal">
                    <UiText text={"操作"} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {(users.rows as any[]).map((u) => (
                  <tr
                    key={u.id}
                    className="border-t border-black/5 dark:border-white/10"
                  >
                    <td className="py-2">
                      {String(u.pen_name)}
                      {Number(u.banned) === 1 && (
                        <span className="ml-1.5 rounded-full bg-vermilion/15 px-1.5 py-0.5 text-[10px] text-vermilion">
                          <UiText text={"已停寄"} />
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-xs text-ink-soft">
                      {String(u.email)}
                    </td>
                    <td className="py-2">{Number(u.letters_sent)}</td>
                    <td className="py-2 text-xs">
                      <UiText
                        text={String(u.role) === "admin" ? "站长" : "局友"}
                      />
                    </td>
                    <td className="py-2 text-xs text-ink-soft">
                      {fmtTime(Number(u.created_at))}
                    </td>
                    <td className="py-2">
                      <div className="flex justify-end gap-1.5">
                        {String(u.role) !== "admin" && (
                          <>
                            <form action={adminToggleRoleAction}>
                              <UiInput
                                type="hidden"
                                name="userId"
                                value={String(u.id)}
                              />
                              <button className="btn-ghost !px-2.5 !py-1 !text-xs">
                                <UiText text={"设为站长"} />
                              </button>
                            </form>
                            <form action={adminToggleBanAction}>
                              <UiInput
                                type="hidden"
                                name="userId"
                                value={String(u.id)}
                              />
                              <button
                                className={`btn-ghost !px-2.5 !py-1 !text-xs ${
                                  Number(u.banned) === 1
                                    ? "!border-vermilion !text-vermilion"
                                    : ""
                                }`}
                              >
                                <UiText
                                  text={
                                    Number(u.banned) === 1 ? "恢复" : "停寄"
                                  }
                                />
                              </button>
                            </form>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </Reveal>

      {/* 信件管理 */}
      <Reveal delay={140}>
        <section className="card glass p-5">
          <h2 className="text-sm font-semibold tracking-widest">
            <UiText text={"最近信件"} />
          </h2>
          <ul className="mt-3 space-y-2">
            {(letters.rows as any[]).map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-black/5 px-3 py-2 text-sm dark:border-white/10"
              >
                <Link href={`/letter/${l.id}`} className="min-w-0 flex-1">
                  <span className="truncate">{String(l.title)}</span>
                  {Number(l.burn_seconds ?? 0) > 0 && (
                    <span className="ml-1.5 rounded-full bg-vermilion/15 px-1.5 py-0.5 text-[10px] text-vermilion">
                      <UiText
                        text={Number(l.burned) === 1 ? "已焚毁" : "阅后即焚"}
                      />
                    </span>
                  )}
                  <span className="ml-2 text-xs text-ink-soft">
                    {String(l.pen_name)} ·{" "}
                    <UiText text={String(l.recipient_id) ? "私信" : "公开"} /> ·{" "}
                    {fmtTime(Number(l.deliver_at))}
                  </span>
                </Link>
                <form action={adminDeleteLetterAction}>
                  <UiInput type="hidden" name="letterId" value={String(l.id)} />
                  <button className="btn-ghost !px-3 !py-1 !text-xs !text-vermilion">
                    <UiText text={"撤下公开展示"} />
                  </button>
                </form>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-soft">
            <UiText text={"待审选题"} />
            {stat.pendingTopics}
            <UiText text={"条 ·"} />{" "}
            <Link href="/topics" className="text-vermilion">
              <UiText text={"去题池 →"} />
            </Link>
          </p>
        </section>
      </Reveal>

      {/* 邀请码 */}
      <Reveal delay={180}>
        <section className="card glass p-5">
          <h2 className="text-sm font-semibold tracking-widest">
            <UiText text={"邀请码"} />
          </h2>
          <p className="mt-1 text-xs text-ink-soft">
            <UiText text={"一次性邀请码，发给新朋友注册用。"} />
          </p>
          <div className="mt-3">
            <GenerateInvites />
          </div>
          {invites.rows.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {invites.rows.map((inv: any) => (
                <li
                  key={inv.code}
                  className={`rounded-xl border px-3 py-1.5 font-mono text-sm ${
                    inv.used_by
                      ? "border-black/5 text-ink-soft line-through dark:border-white/10"
                      : "border-vermilion/40 text-vermilion"
                  }`}
                >
                  {String(inv.code)}
                  {inv.used_by
                    ? `（已用 · ${String(inv.used_by_pen ?? "")}）`
                    : "（未使用）"}
                </li>
              ))}
            </ul>
          )}
        </section>
      </Reveal>
      <Reveal delay={200}>
        <section className="card glass p-5">
          <h2 className="text-sm font-semibold tracking-widest">
            <UiText text={"邮件通道"} />
          </h2>
          <p className="mt-1 text-xs text-ink-soft">
            <UiText
              text={
                "来信送达 / 时光胶囊解锁 / 找回密码验证码 / 生日问候的邮件都走 Resend。填一个你自己的真实邮箱发一封自检信， 收到即说明通道正常；失败时这里会显示 Resend 返回的具体错误（不含密钥）。"
              }
            />
          </p>
          <MailTest
            defaultTo={String(me?.email ?? "")}
            configured={health.config.mail}
          />
        </section>
      </Reveal>
    </div>
  );
}
