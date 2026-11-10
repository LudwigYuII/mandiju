import Link from "next/link";
import Seal from "./Seal";
import Avatar from "./Avatar";
import Stamp from "./Stamp";
import { genreLabel, postageLabel, statusOf } from "@/lib/delivery";
import { stampDefById, imgUrl } from "@/lib/assets";

export type LetterRow = {
  id: string;
  author_id: string;
  recipient_id: string | null;
  genre: string;
  title: string;
  body: string;
  postage: string;
  stamp_id: string;
  weather: string | null;
  city: string | null;
  temp: number | null;
  sent_at: number;
  deliver_at: number;
  pen_name: string;
  avatar_id: string;
  bg_id: string;
  seal_text: string;
  image?: string | null;
  likes: number;
  replies: number;
};

export default function LetterCard({ l, ghost = false }: { l: LetterRow; ghost?: boolean }) {
  const status = statusOf(l.deliver_at);
  const stamp = stampDefById(l.stamp_id);
  const isBurn = Number((l as any).burn_seconds ?? 0) > 0;
  const excerpt = isBurn
    ? "🔥 阅后即焚 · 寄出后不再可读"
    : l.body.length > 80
      ? l.body.slice(0, 80) + "…"
      : l.body;
  return (
    <Link
      href={`/letter/${l.id}`}
      className={`card glass block p-5 transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.99] ${
        ghost ? "border-dashed opacity-70" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Avatar pen={l.pen_name} avatarId={l.avatar_id} bgId={l.bg_id} size={40} />
          <div>
            <div className="flex items-center gap-1.5 text-[16px] font-semibold">
              {l.pen_name}
              <Seal char={l.seal_text || l.pen_name[0]} size={20} />
            </div>
            <div className="text-xs text-ink-soft">
              {genreLabel(l.genre)} · {ghost || status === "in_transit" ? "运输中…" : "已送达"}
            </div>
          </div>
        </div>
        {stamp && <Stamp file={stamp.file} size={60} />}
      </div>
      <div className="mt-3">
        {l.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgUrl(String(l.image))}
            alt={l.genre === "postcard" ? "明信片" : "信中的照片"}
            loading="lazy"
            decoding="async"
            className="mb-3 h-28 w-full rounded-xl object-cover"
          />
        )}
        <div className="text-lg font-semibold tracking-tight">{l.title}</div>
        <div
          className={`mt-1 text-[15px] text-ink-soft line-clamp-3 ${
            l.genre === "poem" ? "poem" : "prose-letter"
          }`}
        >
          {excerpt}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-black/5 pt-2.5 text-xs text-ink-soft dark:border-white/10">
        <span>
          ❤️ {l.likes} · 💬 {l.replies}
        </span>
        <span>{postageLabel(l.postage)}</span>
      </div>
    </Link>
  );
}
