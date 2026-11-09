import Link from "next/link";
import { notFound } from "next/navigation";
import { db, waitDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { genreLabel, statusOf, fmtTime, postageLabel } from "@/lib/delivery";
import { stampDefById, imgUrl } from "@/lib/assets";
import { weatherEmoji, weatherLabel } from "@/lib/weather";
import { friendshipBetween, canWriteTo } from "@/lib/friends";
import Seal from "@/components/Seal";
import Stamp from "@/components/Stamp";
import Avatar from "@/components/Avatar";
import Postmark from "@/components/Postmark";
import LikeButton from "@/components/LikeButton";
import ReplyForm from "@/components/ReplyForm";
import Reveal from "@/components/Reveal";
import Envelope from "@/components/Envelope";
import FriendButton from "@/components/FriendButton";
import BurnReader from "@/components/BurnReader";
import { burnLabel } from "@/lib/burn";
import { wipeBurn } from "@/lib/burn-db";

export const dynamic = "force-dynamic";

export default async function LetterPage({ params }: { params: Promise<{ id: string }> }) {
  await waitDb();
  const { id } = await params;
  const sess = await getSession();

  const r = await db.execute({ sql: "SELECT * FROM letters WHERE id=?", args: [id] });
  const l = r.rows[0] as any;
  if (!l) notFound();

  const isParty =
    !!sess && (sess.uid === String(l.author_id) || sess.uid === String(l.recipient_id));
  const status = statusOf(Number(l.deliver_at));
  const isCapsule = String(l.postage) === "capsule";
  const isBurn = Number(l.burn_seconds ?? 0) > 0;

  if (l.recipient_id && !isParty) notFound(); // 私信只对双方可见
  if (status === "in_transit" && !isParty) notFound(); // 路上的信不对外

  // 阅后即焚兜底：倒计时到期即抹除正文（即便对方中途关掉页面）
  let burned = Number(l.burned) === 1;
  if (isBurn && !burned && Number(l.burned_at ?? 0) > 0 && Number(l.burned_at) <= Date.now()) {
    await wipeBurn(id);
    burned = true;
    l.burned = 1;
    l.title = "（已焚毁）";
    l.body = "";
  }

  const isRecipient = !!sess && String(l.recipient_id) === sess.uid;
  const isAuthor = !!sess && String(l.author_id) === sess.uid;

  // 已读回执：收件人首次打开私信（已送达）时记录；焚毁信在拆封动作里记录
  if (isRecipient && status === "delivered" && !l.read_at && !isBurn) {
    await db.execute({ sql: "UPDATE letters SET read_at=? WHERE id=?", args: [Date.now(), id] });
    l.read_at = Date.now();
  }
  const isAuthorOfPrivate = isAuthor && !!l.recipient_id && !isCapsule;

  const au = await db.execute({ sql: "SELECT * FROM users WHERE id=?", args: [String(l.author_id)] });
  const author = au.rows[0] as any;
  let recipientPen: string | null = null;
  if (l.recipient_id) {
    const rr = await db.execute({
      sql: "SELECT pen_name FROM users WHERE id=?",
      args: [String(l.recipient_id)],
    });
    recipientPen = String(rr.rows[0]?.pen_name ?? "");
  }

  // ---------- 阅后即焚：独立的页面流 ----------
  if (isBurn) {
    const stamp = stampDefById(String(l.stamp_id));
    if (burned) {
      return (
        <div className="mx-auto max-w-md space-y-4 py-10 text-center">
          <div className="card glass grain p-8">
            <div className="ash-rise text-4xl">🔥</div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">已焚毁</h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              这封信已在 {fmtTime(Number(l.burned_at))} 阅后即焚，
              <br />
              连灰烬也没能留下。
            </p>
            <p className="mt-4 text-xs text-ink-soft">
              {isAuthor ? `你寄给 ${recipientPen} 的信` : `${String(author.pen_name)} 寄给你的信`}
            </p>
          </div>
          <Link href="/mail" className="text-sm text-ink-soft hover:text-ink">
            ← 回往来信笺
          </Link>
        </div>
      );
    }

    if (isAuthor) {
      return (
        <div className="mx-auto max-w-md space-y-4 py-10 text-center">
          <div className="card glass grain p-8">
            <div className="text-4xl">🔥</div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">阅后即焚</h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              这封信在寄出的那一刻就已封存——连你自己也无法再读。
              <br />
              唯一一次拆封机会，留给 {recipientPen}。
            </p>
            <p className="mt-5 rounded-xl border border-dashed border-vermilion/40 bg-vermilion/5 px-3 py-2 text-sm text-vermilion">
              {status === "in_transit"
                ? `🚚 还在路上，预计 ${fmtTime(Number(l.deliver_at))} 送达`
                : Number(l.burned_at ?? 0) > 0
                  ? `对方已拆封 · ${burnLabel(Number(l.burn_seconds))} 倒计时已开始`
                  : "已送达 · 对方还未拆封"}
            </p>
          </div>
          <Link href="/mail" className="text-sm text-ink-soft hover:text-ink">
            ← 回往来信笺
          </Link>
        </div>
      );
    }

    if (isRecipient && status === "in_transit") {
      return (
        <div className="mx-auto max-w-md space-y-4 py-10 text-center">
          <div className="card glass grain p-8">
            <div className="text-4xl">🔥</div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">阅后即焚</h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              {String(author.pen_name)} 的信还在路上，预计 {fmtTime(Number(l.deliver_at))} 送达。
              <br />
              送达后拆封即开始 {burnLabel(Number(l.burn_seconds))} 倒计时，读完即焚，只能看这一次。
            </p>
          </div>
          <Link href="/mail" className="text-sm text-ink-soft hover:text-ink">
            ← 回往来信笺
          </Link>
        </div>
      );
    }

    if (isRecipient) {
      return (
        <div className="space-y-4">
          <Link href="/mail" className="text-sm text-ink-soft">
            ← 回往来信笺
          </Link>
          <Reveal>
            <BurnReader
              letterId={id}
              meta={{
                pen: String(author.pen_name),
                seal: String(author.seal_text || author.pen_name[0]),
                stampFile: stamp?.file ?? null,
                city: l.city ? String(l.city) : "",
                deliverAt: Number(l.deliver_at),
                genre: String(l.genre),
                postage: String(l.postage),
                cost: Number(l.cost ?? 0),
                recipientPen: recipientPen ?? "",
                burnSeconds: Number(l.burn_seconds),
              }}
            />
          </Reveal>
        </div>
      );
    }
  }

  const likes = await db.execute({ sql: "SELECT user_id FROM likes WHERE letter_id=?", args: [id] });
  const liked = sess ? likes.rows.some((x: any) => String(x.user_id) === sess.uid) : false;
  const replies = await db.execute({
    sql: `SELECT r.*, u.pen_name, u.avatar_id, u.bg_id, u.seal_text
          FROM replies r JOIN users u ON u.id = r.author_id
          WHERE r.letter_id = ? ORDER BY r.created_at ASC`,
    args: [id],
  });
  const stamp = stampDefById(String(l.stamp_id));

  let original: { id: string; title: string } | null = null;
  if (l.reply_to) {
    const o = await db.execute({ sql: "SELECT id, title FROM letters WHERE id=?", args: [String(l.reply_to)] });
    if (o.rows.length > 0) original = { id: String((o.rows[0] as any).id), title: String((o.rows[0] as any).title) };
  }

  // 笔友关系：决定显示「回信」还是「加为笔友」
  const authorId = String(l.author_id);
  let canReply = false;
  let rel: "none" | "pending_out" | "pending_in" | "friends" = "none";
  let authorBanned = Number(author?.banned ?? 0) === 1;
  if (sess && sess.uid !== authorId && !authorBanned) {
    canReply = await canWriteTo(sess.uid, authorId);
    rel = await friendshipBetween(sess.uid, authorId);
  }

  return (
    <div className="space-y-4">
      <Link href="/" className="text-sm text-ink-soft">
        ← 回邮筒
      </Link>

      <Reveal>
        <Envelope letterId={id} seal={String(author.seal_text || author.pen_name[0])}>
        <article className="card glass grain p-6">
        {/* 抬头 */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <Link href={`/study/${encodeURIComponent(String(author.pen_name))}`} className="flex items-center gap-2.5">
            <Avatar
              pen={String(author.pen_name)}
              avatarId={String(author.avatar_id)}
              bgId={String(author.bg_id)}
              size={44}
            />
            <div>
              <div className="flex items-center gap-1.5 text-[16px] font-semibold">
                {String(author.pen_name)}
                <Seal char={String(author.seal_text || author.pen_name[0])} size={20} />
              </div>
              <div className="text-xs text-ink-soft">
                {genreLabel(String(l.genre))} · {postageLabel(String(l.postage))} · {Number(l.cost)} 文
                {recipientPen ? ` · 寄给 ${recipientPen}` : " · 寄给所有人"}
              </div>
            </div>
          </Link>
          <Postmark city={l.city} time={Number(l.deliver_at)} firstDay={Number(l.first_day) === 1} size={112} />
        </div>

        {status === "in_transit" && (
          <p className="mt-4 rounded-xl border border-dashed border-postblue/50 bg-postblue/5 px-3 py-2 text-sm text-postblue">
            {isCapsule
              ? `⏳ 时光胶囊沉睡中，${fmtTime(Number(l.deliver_at))} 解锁`
              : `🚚 这封信还在路上，预计 ${fmtTime(Number(l.deliver_at))} 送达`}
          </p>
        )}

        {isAuthorOfPrivate && status === "delivered" && (
          <p className="mt-3 text-xs text-ink-soft">
            {l.read_at ? `✓ 对方已读（${fmtTime(Number(l.read_at))}）` : "对方还未读"}
          </p>
        )}

        {l.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgUrl(String(l.image))}
            alt="明信片"
            loading="lazy"
            decoding="async"
            className="mt-5 w-full rounded-2xl object-cover"
          />
        )}

        {/* 正文 */}
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">{String(l.title)}</h1>
        <div className={`mt-3 ${l.genre === "poem" ? "poem" : "prose-letter"} text-[17px]`}>
          {String(l.body)}
        </div>

        {/* 落款 */}
        <div className="mt-6 flex items-end justify-between border-t border-black/5 pt-4 dark:border-white/10">
          <div className="text-sm text-ink-soft">
            {weatherEmoji(Number(l.weather ?? -1) === -1 ? null : Number(l.weather))}{" "}
            {l.city || (l.weather != null ? weatherLabel(Number(l.weather)) : "未盖章")}
            {l.temp != null && ` ${Math.round(Number(l.temp))}°`}
            <div className="mt-1 text-xs">{fmtTime(Number(l.sent_at))} 投递</div>
          </div>
          <div className="flex items-end gap-2">
            {stamp && <Stamp file={stamp.file} size={84} />}
            <Seal char={String(author.seal_text || author.pen_name[0])} size={44} />
          </div>
        </div>
        </article>
        </Envelope>
      </Reveal>

      {/* 点赞 */}
      <div className="flex items-center justify-between gap-3 px-1">
        <LikeButton letterId={id} liked={liked} likes={likes.rows.length} />
        {sess && sess.uid !== authorId && !authorBanned && (
          canReply ? (
            <Link href={`/write?reply=${id}`} className="btn !px-4 !py-2 !text-sm">
              ↩️ 回信
            </Link>
          ) : (
            <FriendButton targetId={authorId} pen={String(author.pen_name)} rel={rel} />
          )
        )}
      </div>

      {original && (
        <p className="px-1 text-xs text-ink-soft">
          这是回给{" "}
          <Link href={`/letter/${original.id}`} className="text-postblue">
            《{original.title}》
          </Link>{" "}
          的信
        </p>
      )}

      {/* 评论 */}
      <Reveal delay={80}>
        <section className="space-y-3">
        <h2 className="px-1 text-sm font-semibold">批注（{replies.rows.length}）</h2>
        {replies.rows.map((rp: any) => (
          <div key={rp.id} className="card flex gap-2.5 p-3.5">
            <Avatar pen={String(rp.pen_name)} avatarId={String(rp.avatar_id)} bgId={String(rp.bg_id)} size={32} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                {String(rp.pen_name)}
                <Seal char={String(rp.seal_text || rp.pen_name[0])} size={16} />
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[15px]">{String(rp.body)}</p>
              <div className="mt-1 text-xs text-ink-soft">{fmtTime(Number(rp.created_at))}</div>
            </div>
          </div>
        ))}
        <ReplyForm letterId={id} signedIn={!!sess} />
        </section>
      </Reveal>
    </div>
  );
}
