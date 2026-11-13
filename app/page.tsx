import { UiText } from "@/components/UiText";

import Link from "next/link";
import { db, waitDb } from "@/lib/db";
import { gateOnboard } from "@/lib/onboard";
import { todayFirstDay } from "@/lib/calendar";
import { siteDateKey, SITE_TIME_ZONE } from "@/lib/time";
export const dynamic = "force-dynamic";
export default async function Home() {
  await waitDb();
  const sess = await gateOnboard();
  const day = todayFirstDay();
  const arrival = sess
    ? (
        await db.execute({
          sql: "SELECT 1 FROM letters WHERE recipient_id=? AND author_id<>? AND deliver_at<=? AND burned=0 LIMIT 1",
          args: [sess.uid, sess.uid, Date.now()],
        })
      ).rows.length > 0
    : false;
  return (
    <div className="desk space-y-12">
      <header className="desk-heading">
        <p className="text-sm tracking-widest text-ink-soft">
          <UiText text={"现代文人雅集"} />
        </p>
        <h1 className="mt-5 text-4xl tracking-widest md:text-5xl">
          <UiText text={"慢递局"} />
        </h1>
        <p className="mt-5 max-w-lg leading-loose text-ink-soft">
          <UiText text={"以被回信取代被看见，以真正的往来取代持续的曝光。"} />
        </p>
      </header>
      <div className="border-y border-black/10 py-4 text-sm text-ink-soft dark:border-white/10">
        <time>{siteDateKey()}</time>
        {day && <span> · {day.name}</span>}
        <span className="ml-3 text-xs">
          <UiText text={"公共时间："} />
          {SITE_TIME_ZONE}
        </span>
      </div>
      <section className="grid gap-6 sm:grid-cols-2">
        <Link className="desk-link" href={sess ? "/write" : "/login"}>
          <h2>
            <UiText text={"写一封信"} />
          </h2>
          <p>
            <UiText text={"慢慢写，不必急着得到回答。"} />
          </p>
        </Link>
        <Link className="desk-link" href={sess ? "/mail" : "/login"}>
          <h2>
            <UiText text={"打开信匣"} />
          </h2>
          <p>
            <UiText
              text={
                arrival ? "有信抵达，留待闲时展读。" : "旧笺与往来，都在这里。"
              }
            />
          </p>
        </Link>
        <Link
          className="desk-link"
          href={sess ? `/study/${encodeURIComponent(sess.pen)}` : "/login"}
        >
          <h2>
            <UiText text={"回到书斋"} />
          </h2>
          <p>
            <UiText text={"安放自己的文字与日常。"} />
          </p>
        </Link>
        <Link className="desk-link" href="/letters">
          <h2>
            <UiText text={"翻阅公共书页"} />
          </h2>
          <p>
            <UiText text={"阅读作者主动公开的作品。"} />
          </p>
        </Link>
      </section>
      <p className="border-t border-black/10 pt-6 text-sm leading-loose text-ink-soft dark:border-white/10">
        <UiText text={"有古意，而不作古；有人情，而不喧哗。"} />
      </p>
    </div>
  );
}
