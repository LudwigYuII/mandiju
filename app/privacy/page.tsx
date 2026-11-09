import Link from "next/link";
import Reveal from "@/components/Reveal";

export default function PrivacyPage() {
  return (
    <div className="space-y-6">
      <h1 className="rise text-3xl font-semibold tracking-tight">隐私政策</h1>
      <Reveal>
        <section className="card glass p-6">
          <h2 className="text-lg font-semibold tracking-tight">客户端下载</h2>
          <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">
            安卓 App 与桌面安装指引，见{" "}
            <Link href="/download" className="text-vermilion hover:underline">
              下载页
            </Link>
            。
          </p>
        </section>
      </Reveal>
      <Reveal>
        <section className="card glass space-y-4 p-6 text-[15px] leading-relaxed">
          <p>「慢递局」是一个属于站长与好友们的小圈子笔友网站。我们重视每位笔友的隐私，并尽可能少地收集数据。</p>
          <h2 className="pt-1 text-lg font-semibold tracking-tight">我们收集什么</h2>
          <ul className="list-inside list-disc space-y-1 text-ink-soft">
            <li>注册时提供的邮箱、笔名、生日（生日仅用于生辰邮票）与头像设置；</li>
            <li>你寄出的信件、批注、点赞与邮票收藏；</li>
            <li>写信时填写的城市与天气（仅作邮戳与纪念票用途）。</li>
          </ul>
          <h2 className="pt-1 text-lg font-semibold tracking-tight">数据如何存放</h2>
          <p className="text-ink-soft">全部数据存放于站长自建的数据库中，不上传、不出售、不用于任何广告或追踪。公开信（寄给所有人的信）可被访客浏览；私信与时光胶囊仅你与收件人可见。</p>
          <h2 className="pt-1 text-lg font-semibold tracking-tight">你的权利</h2>
          <p className="text-ink-soft">你可以随时修改笔名、私印与头像，也可以联系站长删除你的账号与全部数据。</p>
          <h2 className="pt-1 text-lg font-semibold tracking-tight">联系我们</h2>
          <p className="text-ink-soft">
            任何隐私相关的问题，请发邮件至{" "}
            <a href="mailto:ycharsenal@163.com" className="text-vermilion">
              ycharsenal@163.com
            </a>
            。
          </p>
        </section>
      </Reveal>
    </div>
  );
}
