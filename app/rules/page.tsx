import { UiText } from "@/components/UiText";

import Reveal from "@/components/Reveal";

const RULES: { t: string; d: string }[] = [
  {
    t: "彼此尊重",
    d: "这里是朋友们的邮局。不辱骂、不骚扰、不发布攻击性内容；站长保留删除任何信件与批注的权利。",
  },
  {
    t: "原创为先",
    d: "寄出的文字应当是你自己写的。引用他人作品请注明出处，不冒充他人笔名。",
  },
  {
    t: "笔友相知",
    d: "私人信件仅限互为笔友（或曾给你写过信的人）之间互寄。添加笔友请走「笔友」页，私信对方邮箱与账号信息。",
  },
  {
    t: "私信是私密的",
    d: "私信与时光胶囊仅双方可见，请勿未经同意转发他人的信件内容。",
  },
  {
    t: "邮票是纪念",
    d: "节气·节日邮票为当年限定，用后入藏。本站无排行、无稀有度分级，收集是自己的事。",
  },
  {
    t: "慢慢来",
    d: "信会迟到、会等待，这正是慢递局的意义。不催信、不焦虑，像对待一封真正的信那样。",
  },
  {
    t: "反馈与申诉",
    d: "任何问题、投诉或删帖请求，请发邮件至 ycharsenal@163.com。",
  },
];

export default function RulesPage() {
  return (
    <div className="space-y-6">
      <h1 className="rise text-3xl font-semibold tracking-tight">
        <UiText text={"社区规则"} />
      </h1>
      {RULES.map((r, i) => (
        <Reveal key={r.t} delay={i * 60}>
          <section className="card glass p-5">
            <div className="flex items-baseline gap-3">
              <span className="text-lg font-semibold text-vermilion">
                {i + 1}
              </span>
              <div>
                <h2 className="text-base font-semibold tracking-tight">
                  {r.t}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                  {r.d}
                </p>
              </div>
            </div>
          </section>
        </Reveal>
      ))}
    </div>
  );
}
