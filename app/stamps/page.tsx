import { UiText } from "@/components/UiText";

import Link from "next/link";
import { redirect } from "next/navigation";
import manifest from "@/data/manifest.json";
import { db, waitDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  ownedStampIds,
  sentLetterCount,
  applyAchievementGrants,
} from "@/lib/stamps";
import Stamp from "@/components/Stamp";
import Reveal from "@/components/Reveal";
import AchievementProgress from "@/components/AchievementProgress";

export const dynamic = "force-dynamic";

const CAT_LABEL: Record<string, string> = {
  common: "常备款",
  milestone: "里程碑款",
  weather: "气候款",
  birthday: "生辰款",
  solarTerm: "节气款",
  festival: "节日款",
};

export default async function StampsPage() {
  await waitDb();
  const sess = await getSession();
  if (!sess) redirect("/login");
  const [owned, sent] = await Promise.all([
    ownedStampIds(sess.uid),
    sentLetterCount(sess.uid),
  ]);
  // 兜底补发成就通知（幂等）：正常由发信动作触发，旧账号首次访问也在此补齐
  await applyAchievementGrants(sess.uid, sent);

  const groups: { cat: string; items: any[] }[] = [];
  for (const s of manifest.stamps as any[]) {
    let g = groups.find((x) => x.cat === s.category);
    if (!g) {
      g = { cat: s.category, items: [] };
      groups.push(g);
    }
    g.items.push(s);
  }

  return (
    <div className="space-y-6">
      <div className="rise flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">
          <UiText text={"邮票册"} />
        </h1>
      </div>

      <Reveal delay={0}>
        <AchievementProgress sent={sent} />
      </Reveal>

      {groups.map((g, gi) => (
        <Reveal key={g.cat} delay={gi * 70}>
          <section>
            <h2 className="mb-1 px-1 text-xs font-semibold tracking-[0.18em] text-ink-soft">
              {CAT_LABEL[g.cat] ?? g.cat}
              {(g.cat === "solarTerm" || g.cat === "festival") && (
                <span className="ml-2 rounded-full bg-vermilion/10 px-2 py-0.5 text-[10px] font-normal text-vermilion">
                  <UiText text={"岁时图录"} />
                </span>
              )}
            </h2>
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
              {g.items.map((s: any) => {
                const has = owned.has(s.id);
                return (
                  <div key={s.id} className="flex flex-col items-center gap-1">
                    <Stamp file={s.file} size={84} grayscale={false} />
                    <span className="text-xs text-ink-soft">{s.name}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </Reveal>
      ))}

      <p className="text-center text-xs text-ink-soft">
        <UiText text={"旧日收藏仍为你保留，所有票面均可自由选用。"} />
        <br />
        <Link href="/write" className="text-vermilion">
          <UiText text={"去写信 →"} />
        </Link>
      </p>
    </div>
  );
}
