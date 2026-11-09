import Link from "next/link";
import { redirect } from "next/navigation";
import manifest from "@/data/manifest.json";
import { db, waitDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { statusOf, fmtTime } from "@/lib/delivery";
import Seal from "@/components/Seal";
import Avatar from "@/components/Avatar";
import LogoutButton from "@/components/LogoutButton";
import GenerateInvites from "@/components/GenerateInvites";
import SealEditor from "@/components/SealEditor";
import ProfileAvatarEditor from "@/components/ProfileAvatarEditor";
import AppearancePanel from "@/components/AppearancePanel";
import PushToggle from "@/components/PushToggle";
import BirthdayEditor from "@/components/BirthdayEditor";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await waitDb();
  const sess = await getSession();
  if (!sess) redirect("/login");

  const me = (
    await db.execute({ sql: "SELECT * FROM users WHERE id=?", args: [sess.uid] })
  ).rows[0] as any;
  const isAdmin = String(me.role) === "admin";

  const inbox = await db.execute({
    sql: `SELECT l.*, ua.pen_name AS peer_pen, ua.seal_text AS peer_seal
          FROM letters l JOIN users ua ON ua.id = l.author_id
          WHERE l.recipient_id = ? ORDER BY l.deliver_at DESC LIMIT 5`,
    args: [sess.uid],
  });
  const outbox = await db.execute({
    sql: `SELECT l.*, ur.pen_name AS peer_pen, ur.seal_text AS peer_seal
          FROM letters l JOIN users ur ON ur.id = l.recipient_id
          WHERE l.author_id = ? AND l.recipient_id IS NOT NULL
          ORDER BY l.deliver_at DESC LIMIT 5`,
    args: [sess.uid],
  });

  const invites = isAdmin
    ? await db.execute(`
        SELECT i.code, i.created_at, i.used_by, uc.pen_name AS creator, uu.pen_name AS used_by_pen
        FROM invites i
        LEFT JOIN users uc ON uc.id = i.created_by
        LEFT JOIN users uu ON uu.id = i.used_by
        ORDER BY i.created_at DESC LIMIT 100`)
    : await db.execute({
        sql: "SELECT code, created_at, used_by FROM invites WHERE created_by=? ORDER BY created_at DESC",
        args: [sess.uid],
      });

  return (
    <div className="space-y-6">
      <h1 className="rise px-1 text-3xl font-semibold tracking-tight">我</h1>
      <div className="card glass flex items-center gap-4 p-5">
        <Avatar
          pen={String(me.pen_name)}
          avatarId={String(me.avatar_id)}
          bgId={String(me.bg_id)}
          size={64}
        />
        <div>
          <div className="flex items-center gap-1.5 text-lg font-bold">
            {String(me.pen_name)}
            <Seal char={String(me.seal_text || me.pen_name[0])} size={22} />
          </div>
          <div className="text-xs text-ink-soft">
            {String(me.email)} · 已寄出 {Number(me.letters_sent)} 封信 · 余额 {Number(me.coins)} 文
            {me.birthday ? ` · 生日 ${String(me.birthday)}` : ""}
          </div>
        </div>
      </div>

      <section className="card glass p-5">
        <h2 className="text-sm font-semibold tracking-widest">外观</h2>
        <p className="mt-1 text-xs text-ink-soft">主题、全站字体与简繁切换，仅对本设备生效。</p>
        <div className="mt-4">
          <AppearancePanel />
        </div>
      </section>

      <section className="card glass p-5">
        <h2 className="text-sm font-semibold tracking-widest">通知</h2>
        <p className="mt-1 text-xs text-ink-soft">
          新信送达时向本设备推送提醒；只在本设备生效，可随时取消。
        </p>
        <div className="mt-4">
          <PushToggle />
        </div>
      </section>

      <section className="card glass p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-widest">往来信笺</h2>
          <Link href="/mail" className="text-xs text-ink-soft hover:text-ink">
            全部 →
          </Link>
        </div>
        <div className="mt-3 grid gap-6 sm:grid-cols-2">
          {[
            { title: "来信", rows: inbox.rows },
            { title: "去信", rows: outbox.rows },
          ].map((col) => (
            <div key={col.title}>
              <p className="mb-2 text-xs font-semibold text-ink-soft">{col.title}</p>
              {col.rows.length === 0 ? (
                <p className="text-sm text-ink-soft">暂无</p>
              ) : (
                <ul className="space-y-2">
                  {col.rows.map((l: any) => {
                    const delivered = statusOf(Number(l.deliver_at)) === "delivered";
                    return (
                      <li key={l.id}>
                        <Link
                          href={`/letter/${l.id}`}
                          className={`flex items-center justify-between gap-2 rounded-xl border border-black/5 px-3 py-2.5 transition hover:border-vermilion/40 dark:border-white/10 ${
                            delivered ? "" : "border-dashed opacity-70"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{String(l.title)}</div>
                            <div className="text-xs text-ink-soft">
                              {String(l.peer_pen)} · {fmtTime(Number(l.deliver_at))}
                            </div>
                          </div>
                          <span className="shrink-0 text-xs text-ink-soft">
                            {delivered ? "已送达" : "运输中"}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="card glass p-5">
        <h2 className="text-sm font-semibold tracking-widest">头像</h2>
        <p className="mt-1 text-xs text-ink-soft">可以上传自己的图片，也可以用官方汉服小人。</p>
        <div className="mt-4">
          <ProfileAvatarEditor
            pen={String(me.pen_name)}
            currentAvatar={String(me.avatar_id)}
            currentBg={String(me.bg_id)}
            avatars={manifest.avatars as any[]}
            backgrounds={manifest.backgrounds as any[]}
          />
        </div>
      </section>

      <section className="card glass p-5">
        <h2 className="text-sm font-semibold tracking-widest">私印</h2>
        <p className="mt-1 text-xs text-ink-soft">一至两个汉字，盖在你寄出的每封信上。</p>
        <SealEditor current={String(me.seal_text || me.pen_name[0])} />
      </section>

      <section className="card glass p-5">
        <h2 className="text-sm font-semibold tracking-widest">生辰</h2>
        <p className="mt-1 text-xs text-ink-soft">
          生日当天局里会送上问候，当天寄信还能盖「生辰」纪念票。
        </p>
        <div className="mt-4">
          <BirthdayEditor current={me.birthday ? String(me.birthday) : null} />
        </div>
      </section>

      {isAdmin && (
        <section className="card glass border-vermilion/30 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold tracking-widest text-vermilion">邮务总办</h2>
              <p className="mt-1 text-xs text-ink-soft">看板、局友管理、公告与信件管理。</p>
            </div>
            <Link href="/admin" className="btn !px-5 !py-2 !text-sm">
              进入后台 →
            </Link>
          </div>
        </section>
      )}

      <section className="card glass p-5">
        <h2 className="text-sm font-semibold tracking-widest">
          {isAdmin ? "站长工具 · 邀请码管理" : "我的邀请码"}
        </h2>
        <p className="mt-1 text-xs text-ink-soft">
          {isAdmin
            ? "生成一次性邀请码发给朋友，他们就能凭码注册。"
            : "每寄满 10 封信，自动获得 3 枚；把邀请码发给朋友，他们就能凭码注册。"}
        </p>
        {isAdmin && <GenerateInvites />}
        {invites.rows.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">还没有邀请码。</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {invites.rows.map((inv: any) => (
              <li
                key={inv.code}
                className={`rounded-xl border px-3 py-2 font-mono text-sm ${
                  inv.used_by
                    ? "border-black/5 text-ink-soft line-through dark:border-white/10"
                    : "border-vermilion/40 text-vermilion"
                }`}
              >
                {String(inv.code)}
                {inv.used_by
                  ? `（已使用${inv.used_by_pen ? " · " + String(inv.used_by_pen) : ""}）`
                  : "（未使用）"}
                {isAdmin && inv.creator ? ` · 由 ${String(inv.creator)} 生成` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card glass p-5">
        <h2 className="text-sm font-semibold tracking-widest">书信与足迹</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/print?scope=mine" className="btn-ghost !text-sm">
            🖨 书信集（打印成册）
          </Link>
          <Link href="/map" className="btn-ghost !text-sm">
            🗺 城市邮戳地图
          </Link>
          <Link href="/year" className="btn-ghost !text-sm">
            ✨ 年度信笺
          </Link>
          <Link href="/quotes" className="btn-ghost !text-sm">
            📜 小笺库
          </Link>
          <Link href="/changelog" className="btn-ghost !text-sm">
            🧾 更新日志
          </Link>
        </div>
      </section>

      <div className="flex justify-between">
        <LogoutButton />
      </div>
    </div>
  );
}
