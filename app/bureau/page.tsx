import { UiText } from "@/components/UiText";

import Link from "next/link";
import manifest from "@/data/manifest.json";
import { monthStamp, getCurrentTopic, currentHost } from "@/lib/topics";
import { waitDb } from "@/lib/db";
import Stamp from "@/components/Stamp";
import Reveal from "@/components/Reveal";

export const dynamic = "force-dynamic";

const RULES = [
  "岁时图录：节气与节日随历法显示，不设错过惩罚",
  "首日戳：发行首日寄出的信盖「首日戳」",
  "自由选用：不以寄信数量解锁票面、信纸或印章",
  "气候触发：初雪、暴雨、大雾、雷电、大风等特殊天气当天写信即得",
  "无排行、无稀有度分级：收集是自己的事，不搞攀比",
];

export default async function BureauPage() {
  await waitDb();
  const stamp = monthStamp();
  const topic = await getCurrentTopic();
  const host = await currentHost();
  const terms = (manifest.stamps as any[]).filter(
    (s) => s.acquire?.type === "solarTerm",
  );
  const fests = (manifest.stamps as any[]).filter(
    (s) => s.acquire?.type === "festival",
  );

  return (
    <div className="space-y-6">
      <h1 className="rise text-3xl font-semibold tracking-tight">
        <UiText text={"邮务司"} />
      </h1>

      {/* 本月发行 */}
      <Reveal>
        <section className="card glass flex items-center gap-4 p-6">
          {stamp && <Stamp file={stamp.file} size={88} />}
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.18em] text-ink-soft">
              <UiText text={"本月发行"} />
            </p>
            <div className="mt-1 text-lg font-semibold tracking-tight">
              {stamp?.name}
            </div>
            <div className="mt-1 text-xs text-ink-soft">
              {topic ? (
                <>
                  <UiText text={"本月同题「"} />
                  {String(topic.title)}
                  <UiText text={"」已挂出（邮差"} />
                  {host?.pen}），
                  <Link href="/topics" className="text-vermilion">
                    <UiText text={"参加写信 →"} />
                  </Link>
                </>
              ) : (
                <>
                  <UiText text={"本月同题尚未挂出，"} />
                  <Link href="/topics" className="text-vermilion">
                    <UiText text={"去题池看看 →"} />
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>
      </Reveal>

      {/* 节气票 */}
      <Reveal delay={70}>
        <section className="card glass p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs font-semibold tracking-[0.18em] text-ink-soft">
              <UiText text={"节气票 · 二十四枚"} />
            </h2>
            <span className="text-[11px] text-ink-soft">
              <UiText text={"2026 限定 · 发行日写信可选用"} />
            </span>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-6">
            {terms.map((s: any) => (
              <div key={s.id} className="flex flex-col items-center gap-1">
                <Stamp file={s.file} size={72} />
                <span className="text-xs text-ink-soft">{s.name}</span>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      {/* 节日票 */}
      <Reveal delay={120}>
        <section className="card glass p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs font-semibold tracking-[0.18em] text-ink-soft">
              <UiText text={"节日票 · 中西节日"} />
            </h2>
            <span className="text-[11px] text-ink-soft">
              <UiText text={"2026 限定 · 节日前后 3 天可选用"} />
            </span>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-5">
            {fests.map((s: any) => (
              <div key={s.id} className="flex flex-col items-center gap-1">
                <Stamp file={s.file} size={72} />
                <span className="text-xs text-ink-soft">{s.name}</span>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      {/* 制度 */}
      <Reveal delay={170}>
        <section className="card glass p-6">
          <h2 className="text-xs font-semibold tracking-[0.18em] text-ink-soft">
            <UiText text={"局里制度"} />
          </h2>
          <ol className="mt-3 space-y-2">
            {RULES.map((r, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="shrink-0 font-semibold text-vermilion">
                  {i + 1}.
                </span>
                <span className="text-ink-soft">{r}</span>
              </li>
            ))}
          </ol>
        </section>
      </Reveal>
    </div>
  );
}
