import Reveal from "@/components/Reveal";
import Seal from "@/components/Seal";

export default function AboutPage() {
  return (
    <div className="space-y-6">
      <h1 className="rise text-3xl font-semibold tracking-tight">关于本站</h1>
      <Reveal>
        <section className="card glass space-y-4 p-6 text-[15px] leading-relaxed">
          <div className="flex items-center gap-3">
            <Seal char="慢" size={44} />
            <div>
              <div className="text-lg font-semibold tracking-tight">慢递局</div>
              <div className="text-xs tracking-[0.25em] text-ink-soft">给彼此的信，不着急</div>
            </div>
          </div>
          <p>
            慢递局是一个属于站长与好友们的小圈子笔友网站。这里没有算法、没有排行榜，只有书信、邮戳、邮票与等待。
          </p>
          <p className="text-ink-soft">
            每个人用笔名写信，信在路上慢慢走——急递十分钟，慢信可以走上一两天。你可以盖官戳、贴邮票、参加每月的同题共写，也可以写一封信寄给未来的自己。
          </p>
          <div className="border-t border-black/5 pt-4 dark:border-white/10">
            <p className="text-xs tracking-[0.18em] text-ink-soft">站主</p>
            <p className="mt-1 font-semibold">桑海一鱼</p>
            <p className="mt-1 text-xs text-ink-soft">
              联系邮箱：
              <a href="mailto:ycharsenal@163.com" className="text-vermilion">
                ycharsenal@163.com
              </a>
            </p>
          </div>
          <div className="border-t border-black/5 pt-4 text-xs text-ink-soft dark:border-white/10">
            本站邮票与汉服小人素材由 AI 辅助生成、程序后处理；名人笺语摘自公开文献；书法字体使用开源字体
            「霞鹜文楷」「朱雀仿宋」（SIL OFL 许可），正文字体可选「思源宋体」「思源黑体」。
          </div>
        </section>
      </Reveal>
    </div>
  );
}
