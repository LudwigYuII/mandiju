import { UiText, UiInput } from "@/components/UiText";

import Link from "next/link";
import { redirect } from "next/navigation";
import { waitDb } from "@/lib/db";
import { gateOnboard } from "@/lib/onboard";
import {
  friendList,
  pendingRequestsFor,
  searchPen,
  friendshipBetween,
} from "@/lib/friends";
import {
  acceptFriendAction,
  declineFriendAction,
  removeFriendAction,
} from "@/lib/actions";
import FriendButton from "@/components/FriendButton";
import Avatar from "@/components/Avatar";
import Reveal from "@/components/Reveal";

export const dynamic = "force-dynamic";

export default async function FriendsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await waitDb();
  const sess = await gateOnboard();
  if (!sess) redirect("/login");

  const { q = "" } = await searchParams;

  const [friends, incoming, outgoing, results] = await Promise.all([
    friendList(sess.uid),
    pendingRequestsFor(sess.uid, "in"),
    pendingRequestsFor(sess.uid, "out"),
    q.trim() ? searchPen(q.trim(), sess.uid) : Promise.resolve([]),
  ]);

  const withStatus = await Promise.all(
    results.map(async (r) => ({
      ...r,
      rel: await friendshipBetween(sess.uid, r.id),
    })),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="rise text-3xl font-semibold tracking-tight">
          <UiText text={"笔友"} />
        </h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          <UiText text={"只有互相成为笔友，才能给对方寄信——先认识，再写信。"} />
        </p>
      </div>

      {/* 找笔友 */}
      <section
        className="card glass rise p-5"
        style={{ animationDelay: "80ms" }}
      >
        <h2 className="text-sm font-semibold tracking-widest">
          <UiText text={"找一位笔友"} />
        </h2>
        <form action="/friends" method="get" className="mt-3 flex gap-2">
          <UiInput
            name="q"
            defaultValue={q}
            className="input"
            placeholder="按笔名搜索，如：小满"
            maxLength={12}
          />
          <button className="btn shrink-0 !px-5">
            <UiText text={"搜索"} />
          </button>
        </form>
        {q.trim() && (
          <div className="mt-4 space-y-2">
            {withStatus.length === 0 ? (
              <p className="text-sm text-ink-soft">
                <UiText text={"没有找到叫「"} />
                {q}
                <UiText text={"」的笔友。"} />
              </p>
            ) : (
              withStatus.map((r: any) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-black/5 px-3 py-2.5 dark:border-white/10"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar
                      pen={r.pen}
                      avatarId={r.avatarId}
                      bgId={r.bgId}
                      size={36}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">
                        {r.pen}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <FriendButton targetId={r.id} pen={r.pen} rel={r.rel} />
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </section>

      {/* 收到的申请 */}
      {incoming.length > 0 && (
        <Reveal>
          <section className="space-y-2">
            <h2 className="px-1 text-xs font-semibold tracking-[0.18em] text-ink-soft">
              <UiText text={"收到的申请（"} />
              {incoming.length}）
            </h2>
            {incoming.map((r: any) => (
              <div
                key={String(r.requester_id)}
                className="card flex items-center justify-between gap-3 p-4"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar
                    pen={r.pen_name}
                    avatarId={r.avatar_id}
                    bgId={r.bg_id}
                    size={40}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {String(r.pen_name)}
                    </div>
                    <div className="text-xs text-ink-soft">
                      <UiText text={"想和你成为笔友"} />
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <form
                    action={async (fd: FormData) => {
                      "use server";
                      await acceptFriendAction({}, fd);
                    }}
                  >
                    <UiInput
                      type="hidden"
                      name="requesterId"
                      value={String(r.requester_id)}
                    />
                    <button className="btn !px-4 !py-1.5 !text-sm">
                      <UiText text={"接受"} />
                    </button>
                  </form>
                  <form action={declineFriendAction}>
                    <UiInput
                      type="hidden"
                      name="requesterId"
                      value={String(r.requester_id)}
                    />
                    <button className="btn-ghost !px-3 !py-1.5 !text-sm">
                      <UiText text={"婉拒"} />
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </section>
        </Reveal>
      )}

      {/* 寄出的申请 */}
      {outgoing.length > 0 && (
        <Reveal>
          <section className="space-y-2">
            <h2 className="px-1 text-xs font-semibold tracking-[0.18em] text-ink-soft">
              <UiText text={"寄出的申请（"} />
              {outgoing.length}）
            </h2>
            {outgoing.map((r: any) => (
              <div
                key={String(r.addressee_id)}
                className="card flex items-center justify-between gap-3 p-4 opacity-70"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar
                    pen={r.pen_name}
                    avatarId={r.avatar_id}
                    bgId={r.bg_id}
                    size={40}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {String(r.pen_name)}
                    </div>
                    <div className="text-xs text-ink-soft">
                      <UiText text={"等对方回音…"} />
                    </div>
                  </div>
                </div>
                <form action={removeFriendAction}>
                  <UiInput
                    type="hidden"
                    name="otherId"
                    value={String(r.addressee_id)}
                  />
                  <button className="btn-ghost !px-3 !py-1.5 !text-sm">
                    <UiText text={"撤回"} />
                  </button>
                </form>
              </div>
            ))}
          </section>
        </Reveal>
      )}

      {/* 笔友列表 */}
      <Reveal delay={60}>
        <section className="space-y-2">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="text-xs font-semibold tracking-[0.18em] text-ink-soft">
              <UiText text={"我的笔友（"} />
              {friends.length}）
            </h2>
            <Link href="/write" className="text-xs text-vermilion">
              <UiText text={"去写信 →"} />
            </Link>
          </div>
          {friends.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-soft">
              <UiText
                text={"还没有笔友。用上面的搜索找到朋友，互相加为笔友吧。"}
              />
            </p>
          ) : (
            friends.map((r: any) => (
              <div
                key={r.id}
                className="card flex items-center justify-between gap-3 p-4"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar
                    pen={r.pen}
                    avatarId={r.avatarId}
                    bgId={r.bgId}
                    size={40}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {r.pen}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <FriendButton targetId={r.id} pen={r.pen} rel="friends" />
                  <form action={removeFriendAction}>
                    <UiInput type="hidden" name="otherId" value={r.id} />
                    <button
                      className="btn-ghost !px-3 !py-1.5 !text-sm"
                      title="解除笔友"
                    >
                      ✕
                    </button>
                  </form>
                </div>
              </div>
            ))
          )}
        </section>
      </Reveal>
    </div>
  );
}
