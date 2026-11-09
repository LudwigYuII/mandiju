import { redirect } from "next/navigation";
import { db, waitDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { confirmOnboardAction } from "@/lib/actions";
import Reveal from "@/components/Reveal";
import Seal from "@/components/Seal";

export const dynamic = "force-dynamic";

// 与 /rules 口径一致的站内规则
const RULES: { t: string; d: string }[] = [
  { t: "彼此尊重", d: "这里是朋友们的邮局。不辱骂、不骚扰、不发布攻击性内容；站长保留删除任何信件与批注的权利。" },
  { t: "原创为先", d: "寄出的文字应当是你自己写的。引用他人作品请注明出处，不冒充他人笔名。" },
  { t: "笔友相知", d: "私人信件仅限互为笔友（或曾给你写过信的人）之间互寄。添加笔友请走「笔友」页。" },
  { t: "私信是私密的", d: "私信与时光胶囊仅双方可见，请勿未经同意转发他人的信件内容。" },
  { t: "邮票是纪念", d: "节气·节日邮票为当年限定，用后入藏。本站无排行、无稀有度分级，收集是自己的事。" },
  { t: "慢慢来", d: "信会迟到、会等待，这正是慢递局的意义。不催信、不焦虑，像对待一封真正的信那样。" },
  { t: "反馈与申诉", d: "任何问题、投诉或删帖请求，请发邮件至 ycharsenal@163.com。" },
];

export default async function OnboardPage() {
  await waitDb();
  const sess = await getSession();
  if (!sess) redirect("/login");
  const r = await db.execute({
    sql: "SELECT onboarded_at FROM users WHERE id=?",
    args: [sess.uid],
  });
  if (Number((r.rows[0] as any)?.onboarded_at ?? 0)) redirect("/");

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Reveal>
        <section className="card glass p-6">
          <div className="flex items-center gap-3">
            <Seal char="慢" size={44} />
            <div>
              <div className="text-lg font-semibold tracking-tight">
                {sess.pen}，欢迎入局
              </div>
              <div className="text-xs tracking-[0.25em] text-ink-soft">
                给彼此的信，不着急
              </div>
            </div>
          </div>
          <p className="mt-4 text-[15px] leading-relaxed">
            慢递局是一个属于站长与好友们的小圈子笔友网站。这里没有算法、没有排行榜，
            只有书信、邮戳、邮票与等待。每个人用笔名写信，信在路上慢慢走——急递十分钟，
            慢信可以走上一两天。你可以盖官戳、贴邮票、参加每月的同题共写，
            也可以写一封信寄给未来的自己。
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
            入局前，请先花一分钟读完下面的约定。
          </p>
        </section>
      </Reveal>

      <Reveal delay={80}>
        <section className="card glass p-6">
          <h2 className="text-base font-semibold tracking-tight">站内规则</h2>
          <ol className="mt-3 space-y-2.5">
            {RULES.map((r, i) => (
              <li key={r.t} className="flex items-baseline gap-2.5 text-sm leading-relaxed">
                <span className="shrink-0 font-semibold text-vermilion">{i + 1}</span>
                <span>
                  <span className="font-semibold">{r.t}</span>
                  <span className="text-ink-soft"> · {r.d}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </Reveal>

      <Reveal delay={140}>
        <section className="card glass p-6">
          <h2 className="text-base font-semibold tracking-tight">隐私与阅后即焚</h2>
          <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-ink-soft">
            <li>
              数据都存在站长自己的数据库里，不上传、不出售、不做任何广告追踪；公开信可被访客浏览，
              私信与时光胶囊仅你与收件人可见。
            </li>
            <li>
              私信寄出即封存：只有你和收件人可见，寄出后连你自己也无法修改或追回。
            </li>
            <li>
              「阅后即焚」是给笔友的小仪式：对方首次拆封即开始倒计时，读完即焚。诚实说明：
              焚毁之前信文仍存放于站内数据库中，站长可以查看——但站长不会提前拆看你的信。
            </li>
          </ul>
        </section>
      </Reveal>

      <Reveal delay={200}>
        <section className="card glass p-6">
          <h2 className="text-base font-semibold tracking-tight">邀请码与「文」</h2>
          <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-ink-soft">
            <li>
              每寄满 10 封信，自动获得 3 枚邀请码——把慢递局分享给值得的人，凭码注册入局。
            </li>
            <li>
              「文」是局里的邮资：急递 100 文、平信 50 文、慢信 20 文；注册赠 500 文，
              每天登录还发 300 文，够你慢慢写。
            </li>
          </ul>
        </section>
      </Reveal>

      <Reveal delay={260}>
        <form action={confirmOnboardAction} className="flex justify-center pb-4 pt-1">
          <button type="submit" className="btn !px-10 !py-3.5 !text-base">
            我已阅读，入局
          </button>
        </form>
      </Reveal>
    </div>
  );
}
