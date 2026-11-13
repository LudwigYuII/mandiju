import { UiText } from "@/components/UiText";

import Link from "next/link";
import { notFound } from "next/navigation";
import { db, waitDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { genreLabel, statusOf, fmtTime, postageLabel } from "@/lib/delivery";
import { stampDefById, imgUrl } from "@/lib/assets";
import { weatherEmoji, weatherLabel } from "@/lib/weather";
import { friendshipBetween, canWriteTo } from "@/lib/friends";
import Seal, {
  sealToneOf,
  sealPatternOf,
  sealToneToRender,
  type LetterSealTone,
  type SealPattern,
} from "@/components/Seal";
import { paperKindOf, paperClass, type PaperKind } from "@/components/paper";
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

import { canReadLetter } from "@/lib/letter-policy";
import { readableLetter } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function LetterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await waitDb();
  const { id } = await params;
  const sess = await getSession();

  const r = await db.execute({
    sql: "SELECT * FROM letters WHERE id=?",
    args: [id],
  });
  const l = r.rows[0] as any;
  if (!l) notFound();

  const isParty =
    !!sess &&
    (sess.uid === String(l.author_id) || sess.uid === String(l.recipient_id));
  const status = statusOf(Number(l.deliver_at));
  const isCapsule = String(l.postage) === "capsule";
  const isBurn = Number(l.burn_seconds ?? 0) > 0;
  const isPostcard = String(l.genre) === "postcard";
  // 贴在信纸上的照片：由信件 id 算一个稳定的轻微倾斜（-1.5°～1.5°），同一封信每次打开角度一致
  const photoTilt = (() => {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 1000;
    return (h / 1000) * 3 - 1.5;
  })();

  if (!canReadLetter(l, sess?.uid)) notFound();

  // 阅后即焚兜底：倒计时到期即抹除正文（即便对方中途关掉页面）
  let burned = Number(l.burned) === 1;
  if (
    isBurn &&
    !burned &&
    Number(l.burned_at ?? 0) > 0 &&
    Number(l.burned_at) <= Date.now()
  ) {
    await wipeBurn(id);
    burned = true;
    l.burned = 1;
    l.title = "（已焚毁）";
    l.body = "";
  }

  const isRecipient = !!sess && String(l.recipient_id) === sess.uid;
  const isAuthor = !!sess && String(l.author_id) === sess.uid;

  const isAuthorOfPrivate = isAuthor && !!l.recipient_id && !isCapsule;

  const au = await db.execute({
    sql: "SELECT * FROM public_users WHERE id=?",
    args: [String(l.author_id)],
  });
  const author = au.rows[0] as any;
  let recipientPen: string | null = null;
  if (l.recipient_id) {
    const rr = await db.execute({
      sql: "SELECT pen_name FROM public_users WHERE id=?",
      args: [String(l.recipient_id)],
    });
    recipientPen = String(rr.rows[0]?.pen_name ?? "");
  }

  // 信件自己的火漆与信纸（旧信无此字段时回落默认）
  const sealColor: LetterSealTone = sealToneOf(l.seal_color);
  const sealPattern: SealPattern = sealPatternOf(l.seal_pattern);
  const paperKind: PaperKind = paperKindOf(l.paper);
  const isVertical = Number(l.vertical) === 1;

  // ---------- 阅后即焚：独立的页面流 ----------
  if (isBurn && isAuthor && !isRecipient)
    return (
      <section className="space-y-5">
        <h1 className="text-2xl">
          <UiText text={"封存信笺"} />
        </h1>
        <p className="leading-loose text-ink-soft">
          <UiText
            text={
              "这封信按寄出时的约定封存。不提供对方的拆封、阅读或焚毁状态。"
            }
          />
        </p>
        <p>
          <UiText text={status === "delivered" ? "已送达" : "驿马已出发"} />
        </p>
        <Link className="btn-ghost" href="/mail">
          <UiText text={"回到信匣"} />
        </Link>
      </section>
    );
  if (isBurn) {
    const stamp = stampDefById(String(l.stamp_id));
    if (burned) {
      return (
        <div className="mx-auto max-w-md space-y-4 py-10 text-center">
          <div className="card glass grain p-8">
            <div className="ash-rise text-4xl">🔥</div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">
              <UiText text={"已焚毁"} />
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              <UiText text={"这封信已在"} />
              {fmtTime(Number(l.burned_at))}
              <UiText text={"阅后即焚，"} />
              <br />
              <UiText text={"连灰烬也没能留下。"} />
            </p>
            <p className="mt-4 text-xs text-ink-soft">
              {isAuthor
                ? `你寄给 ${recipientPen} 的信`
                : `${String(author.pen_name)} 寄给你的信`}
            </p>
          </div>
          <Link href="/mail" className="text-sm text-ink-soft hover:text-ink">
            <UiText text={"← 回往来信笺"} />
          </Link>
        </div>
      );
    }

    if (isAuthor) {
      return (
        <div className="mx-auto max-w-md space-y-4 py-10 text-center">
          <div className="card glass grain p-8">
            <div className="text-4xl">🔥</div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">
              <UiText text={"阅后即焚"} />
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              <UiText
                text={"这封信在寄出的那一刻就已封存——连你自己也无法再读。"}
              />
              <br />
              <UiText text={"唯一一次拆封机会，留给"} />
              {recipientPen}。
            </p>
            <p className="mt-5 rounded-xl border border-dashed border-vermilion/40 bg-vermilion/5 px-3 py-2 text-sm text-vermilion">
              {status === "in_transit"
                ? `🚚 还在路上，预计 ${fmtTime(Number(l.deliver_at))} 送达`
                : Number(l.burned_at ?? 0) > 0
                  ? "已送达"
                  : "已送达"}
            </p>
          </div>
          <Link href="/mail" className="text-sm text-ink-soft hover:text-ink">
            <UiText text={"← 回往来信笺"} />
          </Link>
        </div>
      );
    }

    if (isRecipient && status === "in_transit") {
      return (
        <div className="mx-auto max-w-md space-y-4 py-10 text-center">
          <div className="card glass grain p-8">
            <div className="text-4xl">🔥</div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">
              <UiText text={"阅后即焚"} />
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              {String(author.pen_name)}
              <UiText text={"的信还在路上，预计"} />
              {fmtTime(Number(l.deliver_at))}
              <UiText text={"送达。"} />
              <br />
              <UiText text={"送达后拆封即开始"} />
              {burnLabel(Number(l.burn_seconds))}
              <UiText text={"倒计时，读完即焚，只能看这一次。"} />
            </p>
          </div>
          <Link href="/mail" className="text-sm text-ink-soft hover:text-ink">
            <UiText text={"← 回往来信笺"} />
          </Link>
        </div>
      );
    }

    if (isRecipient) {
      return (
        <div className="reading-room space-y-4">
          <Link href="/mail" className="text-sm text-ink-soft">
            <UiText text={"← 回往来信笺"} />
          </Link>
          <Reveal>
            <BurnReader
              letterId={id}
              meta={{
                pen: String(author.pen_name),
                seal: String(author.seal_text || author.pen_name[0]),
                sealColor,
                sealPattern,
                paper: paperKind,
                vertical: isVertical ? 1 : 0,
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

  const likes = await db.execute({
    sql: "SELECT user_id FROM likes WHERE letter_id=?",
    args: [id],
  });
  const liked = sess
    ? likes.rows.some((x: any) => String(x.user_id) === sess.uid)
    : false;
  const replies = await db.execute({
    sql: `SELECT r.*, u.pen_name, u.avatar_id, u.bg_id, u.seal_text
          FROM replies r JOIN public_users u ON u.id = r.author_id
          WHERE r.letter_id = ? ORDER BY r.created_at ASC`,
    args: [id],
  });
  const stamp = stampDefById(String(l.stamp_id));

  let original: { id: string; title: string } | null = null;
  if (l.reply_to) {
    const o = await readableLetter(String(l.reply_to), sess?.uid);
    if (o) original = { id: String(o.id), title: String(o.title) };
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
    <div className="reading-room space-y-4">
      <Link href="/" className="text-sm text-ink-soft">
        <UiText text={"← 回邮筒"} />
      </Link>

      <Reveal>
        <Envelope
          letterId={id}
          seal={String(author.seal_text || author.pen_name[0])}
          sealColor={sealColor}
          sealPattern={sealPattern}
        >
          <article className={`card glass grain ${paperClass(paperKind)} p-6`}>
            {/* 抬头 */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <Link
                href={`/study/${encodeURIComponent(String(author.pen_name))}`}
                className="flex items-center gap-2.5"
              >
                <Avatar
                  pen={String(author.pen_name)}
                  avatarId={String(author.avatar_id)}
                  bgId={String(author.bg_id)}
                  size={44}
                />
                <div>
                  <div className="flex items-center gap-1.5 text-[16px] font-semibold">
                    {String(author.pen_name)}
                    <Seal
                      char={String(author.seal_text || author.pen_name[0])}
                      size={20}
                    />
                  </div>
                  <div className="text-xs text-ink-soft">
                    {genreLabel(String(l.genre))} ·{" "}
                    {postageLabel(String(l.postage))}
                    {recipientPen ? ` · 寄给 ${recipientPen}` : " · 寄给所有人"}
                  </div>
                </div>
              </Link>
              <Postmark
                city={l.city}
                time={Number(l.deliver_at)}
                firstDay={Number(l.first_day) === 1}
                size={112}
              />
            </div>

            {status === "in_transit" && (
              <p className="mt-4 rounded-xl border border-dashed border-postblue/50 bg-postblue/5 px-3 py-2 text-sm text-postblue">
                {isCapsule
                  ? `⏳ 时光胶囊沉睡中，${fmtTime(Number(l.deliver_at))} 解锁`
                  : `🚚 这封信还在路上，预计 ${fmtTime(Number(l.deliver_at))} 送达`}
              </p>
            )}

            {l.image && isPostcard && (
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
            <h1 className="mt-5 text-2xl font-semibold tracking-tight">
              {String(l.title)}
            </h1>
            <div
              className={`mt-3 ${l.genre === "poem" ? "poem" : "prose-letter"} text-[17px] ${
                isVertical ? "writing-vertical" : ""
              }`}
            >
              {String(l.body)}
            </div>

            {/* 普通信的照片：像一张贴在信纸上的相片（白边、轻微倾斜、柔和投影） */}
            {!isPostcard && l.image && !burned && (
              <figure className="mt-7 flex justify-center">
                <div
                  className="max-w-[86%] border-[6px] border-white bg-white shadow-[0_12px_28px_-10px_rgba(28,23,18,0.5)] sm:max-w-[420px]"
                  style={{ transform: `rotate(${photoTilt.toFixed(2)}deg)` }}
                >
                  <img
                    src={imgUrl(String(l.image))}
                    alt={`${String(l.title)} 随信附上的照片`}
                    loading="lazy"
                    decoding="async"
                    className="block h-auto max-h-[420px] w-auto max-w-full object-contain"
                  />
                </div>
              </figure>
            )}

            {/* 落款 */}
            <div
              className={`mt-6 flex items-end justify-between border-t pt-4 ${
                paperKind === "night"
                  ? "border-white/15"
                  : "border-black/5 dark:border-white/10"
              }`}
            >
              <div className="text-sm text-ink-soft">
                {weatherEmoji(
                  Number(l.weather ?? -1) === -1 ? null : Number(l.weather),
                )}{" "}
                {l.city ||
                  (l.weather != null
                    ? weatherLabel(Number(l.weather))
                    : "未盖章")}
                {l.temp != null && ` ${Math.round(Number(l.temp))}°`}
                <div className="mt-1 text-xs">
                  {fmtTime(Number(l.sent_at))}
                  <UiText text={"投递"} />
                </div>
              </div>
              <div className="flex items-end gap-2">
                {stamp && <Stamp file={stamp.file} size={84} />}
                <Seal
                  char={String(author.seal_text || author.pen_name[0])}
                  size={44}
                  tone={sealToneToRender(sealColor)}
                  pattern={sealPattern}
                />
              </div>
            </div>
          </article>
        </Envelope>
      </Reveal>

      {/* 点赞 */}
      <div className="flex items-center justify-between gap-3 px-1">
        <LikeButton letterId={id} liked={liked} likes={likes.rows.length} />
        {sess &&
          sess.uid !== authorId &&
          !authorBanned &&
          (canReply ? (
            <Link
              href={`/write?reply=${id}`}
              className="btn !px-4 !py-2 !text-sm"
            >
              <UiText text={"↩️ 回信"} />
            </Link>
          ) : (
            <FriendButton
              targetId={authorId}
              pen={String(author.pen_name)}
              rel={rel}
            />
          ))}
      </div>

      {original && (
        <p className="px-1 text-xs text-ink-soft">
          <UiText text={"这是回给"} />{" "}
          <Link href={`/letter/${original.id}`} className="text-postblue">
            《{original.title}》
          </Link>{" "}
          <UiText text={"的信"} />
        </p>
      )}

      {/* 评论 */}
      <Reveal delay={80}>
        <section className="space-y-3">
          <h2 className="px-1 text-sm font-semibold">
            <UiText text={"批注（"} />
            {replies.rows.length}）
          </h2>
          {replies.rows.map((rp: any) => (
            <div key={rp.id} className="card flex gap-2.5 p-3.5">
              <Avatar
                pen={String(rp.pen_name)}
                avatarId={String(rp.avatar_id)}
                bgId={String(rp.bg_id)}
                size={32}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  {String(rp.pen_name)}
                  <Seal
                    char={String(rp.seal_text || rp.pen_name[0])}
                    size={16}
                  />
                </div>
                <p className="mt-1 whitespace-pre-wrap text-[15px]">
                  {String(rp.body)}
                </p>
                <div className="mt-1 text-xs text-ink-soft">
                  {fmtTime(Number(rp.created_at))}
                </div>
              </div>
            </div>
          ))}
          <ReplyForm letterId={id} signedIn={!!sess} />
        </section>
      </Reveal>
    </div>
  );
}
