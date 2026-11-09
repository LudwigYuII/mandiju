import Link from "next/link";
import { redirect } from "next/navigation";
import { db, waitDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { fmtTime } from "@/lib/delivery";
import {
  adminDeleteLetterAction,
  adminToggleBanAction,
  adminToggleRoleAction,
  createAnnouncementAction,
  deleteAnnouncementAction,
} from "@/lib/actions";
import GenerateInvites from "@/components/GenerateInvites";
import Reveal from "@/components/Reveal";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await waitDb();
  const sess = await getSession();
  if (!sess) redirect("/login");
  const me = (await db.execute({ sql: "SELECT role FROM users WHERE id=?", args: [sess.uid] })).rows[0] as any;
  if (String(me?.role) !== "admin") redirect("/");

  const [users, stats, letters, announcements, invites, pool] = await Promise.all([
    db.execute("SELECT id, pen_name, email, role, banned, letters_sent, coins, created_at FROM users ORDER BY created_at ASC"),
    Promise.all([
      db.execute("SELECT COUNT(*) AS n FROM users"),
      db.execute("SELECT COUNT(*) AS n FROM letters"),
      db.execute("SELECT COUNT(*) AS n FROM letters WHERE recipient_id IS NULL"),
      db.execute("SELECT COUNT(*) AS n FROM likes"),
      db.execute("SELECT COUNT(*) AS n FROM replies"),
      db.execute("SELECT COUNT(*) AS n FROM invites WHERE used_by IS NULL"),
    ]),
    db.execute(`SELECT l.id, l.title, l.genre, l.deliver_at, l.recipient_id, l.burn_seconds, l.burned, u.pen_name
                FROM letters l JOIN users u ON u.id = l.author_id
                ORDER BY l.sent_at DESC LIMIT 20`),
    db.execute("SELECT * FROM announcements ORDER BY pinned DESC, created_at DESC LIMIT 20"),
    db.execute(`SELECT i.code, i.created_at, i.used_by, uu.pen_name AS used_by_pen
                FROM invites i LEFT JOIN users uu ON uu.id = i.used_by
                ORDER BY i.created_at DESC LIMIT 50`),
    db.execute("SELECT COUNT(*) AS n FROM topic_pool WHERE status='pending'"),
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="rise text-3xl font-semibold tracking-tight">邮务总办</h1>
        <span className="text-xs text-ink-soft">站长后台 · {sess.pen}</span>
      </div>

      {/* 看板 */}
      <Reveal>
        <section className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
          {cards.map((c) => (
            <div key={c.label} className="card glass p-3.5 text-center">
              <div className="text-2xl font-semibold text-vermilion">{c.value}</div>
              <div className="mt-0.5 text-xs text-ink-soft">{c.label}</div>
            </div>
          ))}
        </section>
      </Reveal>

      {/* 公告 */}
      <Reveal delay={60}>
        <section className="card glass p-5">
          <h2 className="text-sm font-semibold tracking-widest">公告</h2>
          <p className="mt-1 text-xs text-ink-soft">发布后会出现在所有局友的首页。</p>
          <form
            action={async (fd: FormData) => {
              "use server";
              await createAnnouncementAction({}, fd);
            }}
            className="mt-3 flex flex-col gap-2 sm:flex-row"
          >
            <input name="body" className="input flex-1" placeholder="公告内容（最多 200 字）" maxLength={200} />
            <label className="flex shrink-0 items-center gap-1.5 text-sm text-ink-soft">
              <input type="checkbox" name="pinned" value="1" />
              置顶
            </label>
            <button className="btn shrink-0 !px-5">发布</button>
          </form>
          {announcements.rows.length > 0 && (
            <ul className="mt-3 space-y-2">
              {announcements.rows.map((a: any) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-black/5 px-3 py-2 text-sm dark:border-white/10"
                >
                  <span className="min-w-0 flex-1">
                    {Number(a.pinned) === 1 && <span className="mr-1.5 text-vermilion">📌</span>}
                    {String(a.body)}
                    <span className="ml-2 text-xs text-ink-soft">{fmtTime(Number(a.created_at))}</span>
                  </span>
                  <form action={deleteAnnouncementAction}>
                    <input type="hidden" name="id" value={String(a.id)} />
                    <button className="btn-ghost !px-3 !py-1 !text-xs">撤下</button>
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
          <h2 className="text-sm font-semibold tracking-widest">局友（{stat.users}）</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-soft">
                  <th className="pb-2 font-normal">笔名</th>
                  <th className="pb-2 font-normal">邮箱</th>
                  <th className="pb-2 font-normal">寄出</th>
                  <th className="pb-2 font-normal">身份</th>
                  <th className="pb-2 font-normal">入局</th>
                  <th className="pb-2 text-right font-normal">操作</th>
                </tr>
              </thead>
              <tbody>
                {(users.rows as any[]).map((u) => (
                  <tr key={u.id} className="border-t border-black/5 dark:border-white/10">
                    <td className="py-2">
                      {String(u.pen_name)}
                      {Number(u.banned) === 1 && (
                        <span className="ml-1.5 rounded-full bg-vermilion/15 px-1.5 py-0.5 text-[10px] text-vermilion">
                          已停寄
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-xs text-ink-soft">{String(u.email)}</td>
                    <td className="py-2">{Number(u.letters_sent)}</td>
                    <td className="py-2 text-xs">{String(u.role) === "admin" ? "站长" : "局友"}</td>
                    <td className="py-2 text-xs text-ink-soft">{fmtTime(Number(u.created_at))}</td>
                    <td className="py-2">
                      <div className="flex justify-end gap-1.5">
                        {String(u.role) !== "admin" && (
                          <>
                            <form action={adminToggleRoleAction}>
                              <input type="hidden" name="userId" value={String(u.id)} />
                              <button className="btn-ghost !px-2.5 !py-1 !text-xs">设为站长</button>
                            </form>
                            <form action={adminToggleBanAction}>
                              <input type="hidden" name="userId" value={String(u.id)} />
                              <button
                                className={`btn-ghost !px-2.5 !py-1 !text-xs ${
                                  Number(u.banned) === 1 ? "!border-vermilion !text-vermilion" : ""
                                }`}
                              >
                                {Number(u.banned) === 1 ? "恢复" : "停寄"}
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
          <h2 className="text-sm font-semibold tracking-widest">最近信件</h2>
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
                      {Number(l.burned) === 1 ? "已焚毁" : "阅后即焚"}
                    </span>
                  )}
                  <span className="ml-2 text-xs text-ink-soft">
                    {String(l.pen_name)} · {String(l.recipient_id) ? "私信" : "公开"} ·{" "}
                    {fmtTime(Number(l.deliver_at))}
                  </span>
                </Link>
                <form action={adminDeleteLetterAction}>
                  <input type="hidden" name="letterId" value={String(l.id)} />
                  <button className="btn-ghost !px-3 !py-1 !text-xs !text-vermilion">删除</button>
                </form>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-soft">
            待审选题 {stat.pendingTopics} 条 ·{" "}
            <Link href="/topics" className="text-vermilion">
              去题池 →
            </Link>
          </p>
        </section>
      </Reveal>

      {/* 邀请码 */}
      <Reveal delay={180}>
        <section className="card glass p-5">
          <h2 className="text-sm font-semibold tracking-widest">邀请码</h2>
          <p className="mt-1 text-xs text-ink-soft">一次性邀请码，发给新朋友注册用。</p>
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
    </div>
  );
}
