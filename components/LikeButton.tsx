"use client";

import { useTransition } from "react";
import { toggleLikeAction } from "@/lib/actions";

export default function LikeButton({
  letterId,
  liked,
  likes,
}: {
  letterId: string;
  liked: boolean;
  likes: number;
}) {
  const [pending, start] = useTransition();
  return (
    <form action={(fd) => start(() => toggleLikeAction(fd))}>
      <input type="hidden" name="letterId" value={letterId} />
      <button
        disabled={pending}
        className={`rounded-full border px-3.5 py-1.5 text-sm transition-transform active:scale-90 ${
          liked
            ? "border-vermilion bg-vermilion/10 text-vermilion"
            : "border-black/10 text-ink-soft dark:border-white/15"
        }`}
      >
        {liked ? "❤️" : "🤍"} {likes} {liked ? "已贴" : "贴邮票"}
      </button>
    </form>
  );
}
