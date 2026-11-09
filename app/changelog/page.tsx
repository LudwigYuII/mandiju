import Reveal from "@/components/Reveal";

const LOG: { v: string; date: string; items: string[] }[] = [
  {
    v: "v1.5 · 鸿雁",
    date: "2026-11-09",
    items: [
      "笔友系统：只有互相加为笔友才能互寄私人信，寄信对象不再公开全部账号；收到过对方的信即可回信",
      "「笔友」页：按笔名搜索、寄出/接受申请、管理笔友；书房页可一键加笔友",
      "信封拆封仪式：首次打开一封信先见信封与火漆印，点击启封展开信纸（带纸张窸窣声）",
      "站长后台「邮务总办」：数据看板、局友管理（停寄/设站长）、信件管理、公告发布、邀请码",
      "首页公告栏：站长公告置顶展示",
      "生辰与节气提醒：生日问候（站内信 + 邮件）、节气首日提醒，每日定时送达（北京时间 8:00）",
      "设置页新增生辰修改；首页提示临近节气发行与生日纪念票",
      "性能提速：并行查询、首页分页、图片懒加载、骨架屏、香港区域加速，加载更快",
      "桌面宽屏布局：大屏下首页双栏（时间线 + 公告/留言侧栏）",
    ],
  },
  {
    v: "v1.4",
    date: "2026-11-08",
    items: [
      "邮票发行规则修正：节气（当日）·节日（前后 3 天）窗口内邮票在写信页可选用，用后即入藏；当年限定，次年新图案",
      "自托管开源书法字体（霞鹜文楷、朱雀仿宋），私印与官戳在任何设备上字形一致",
      "新增「小笺库」：100 条笺语可浏览、检索、一键复制",
      "新增「更新日志」页",
    ],
  },
  {
    v: "v1.3",
    date: "2026-11-08",
    items: [
      "回信闭环：信详情页一键回信，自动引用原信",
      "草稿箱：写信可随时存档，下次接着写",
      "书信集：我的信 / 全站公开信 / 与某人的往来，可打印或存为 PDF",
      "城市邮戳地图：寄出与收到的信盖过的城市在地图上点亮",
      "年度信笺：年度统计卡片 + 可复制摘要",
      "投递盖章音效、首页局内钟（节气与在途倒计时）、PWA 主屏图标、信纸纸纹",
    ],
  },
  {
    v: "v1.2",
    date: "2026-11-07",
    items: [
      "同题共写：题池投题、轮值邮差每月挂题、参与解锁当月节气纪念票",
      "邮务司：发行历与局里制度五条",
    ],
  },
  {
    v: "v1.1",
    date: "2026-11-07",
    items: [
      "「文」货币：急递 100 文 / 平信 50 文 / 慢信 20 文，注册赠 500 文，每日登录 300 文",
      "邮资调整：急递 10 分钟、平信 2–5 小时、慢信 1–2 天",
      "仿真官戳（上环城市 + 日期 + 下环邮局 + 水波纹），投递盖章动画",
      "私印自由选择（1–2 字，可随时更改）",
      "明信片（一图一句）与时光胶囊（写给未来的自己，零邮资）",
      "首日戳、建站周年票、邮件送达通知",
      "头像上传（汉服小人定为官方头像）",
    ],
  },
  {
    v: "v1.0",
    date: "2026-11-07",
    items: [
      "慢递局开张：邀请制注册、写信（书信/日常/诗歌）、邮资延迟、邮戳与私印",
      "贴邮票点赞、批注、站内私信与往来信笺、留言墙、书房、邮票册",
      "笺语 100 条、深色模式、iOS 质感设计语言",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div className="space-y-6">
      <h1 className="rise text-3xl font-semibold tracking-tight">更新日志</h1>
      {LOG.map((g, i) => (
        <Reveal key={g.v} delay={i * 60}>
          <section className="card glass p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold tracking-tight">{g.v}</h2>
              <span className="text-xs text-ink-soft">{g.date}</span>
            </div>
            <ul className="mt-3 space-y-2">
              {g.items.map((it) => (
                <li key={it} className="flex gap-2 text-sm">
                  <span className="shrink-0 text-vermilion">·</span>
                  <span className="text-ink-soft">{it}</span>
                </li>
              ))}
            </ul>
          </section>
        </Reveal>
      ))}
    </div>
  );
}
