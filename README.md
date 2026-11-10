# 「慢递局」web（v1）

书信主题的笔友网站。iOS 极简质感为骨，书信国风为肉。

## 技术栈

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · @libsql/client (SQLite) · jose (JWT 会话) · bcryptjs

## 运行

```powershell
# 安装（注意：node_modules 使用 pnpm 平铺模式，见 pnpm-workspace.yaml）
pnpm install
pnpm dev            # http://localhost:3100（本机端口 3100，见下方说明）
```

> 开发服务器端口设为 3100（命令见 `tools/dev.ps1` 同类写法：直接以 node 调
> `node_modules\next\dist\bin\next dev -p 3100`，因沙箱环境 PATH 与 fork 权限原因）。

## 初始账号与邀请码

- 管理员：`admin@mandiju.dev`，口令由环境变量 `MDJ_ADMIN_PASS` 指定；未配置时首次初始化会随机生成一次性口令并打印在部署日志里（登录后请立即改密）。
- 开张邀请码：`KAIZHANG`（首次注册用，用完即失效；之后每寄满 10 封信自动获得 3 枚）

## 已实现（v1）

- 邀请码注册（选汉服小人 + 背景 + 生日）+ 邮箱密码登录 + JWT 会话
- 写信：三体裁（书信/日常/诗歌，诗歌居中排版）、收件人模型（所有人/某位笔友）、
  邮资三档（航空≈5分钟/平信2-6小时/慢信1-3天）、贴邮票、定位盖章（Geolocation + Open-Meteo +
  Nominatim 反查，拒绝时手动选天气）、私印（首字朱红章）
- 投递状态机：运输中的信对作者显示虚影卡片，送达后进入时间线（懒计算，无需 cron）
- 贴邮票点赞（可取消）、楼层评论、私信往来（/mail）、留言墙（30 条收进旧箱）
- 书房（/study/[笔名]）、邮票册（六类图鉴 + 收集态灰度锁定）、设置页（邀请码清单、退出）
- 笺语：首页随机语录（data/quotes.json，100 条）；深色模式（localStorage + 毛玻璃）
- 邮票发放：第 10/50/100 封信里程碑、特殊天气写信、生日当天写信（对应 manifest acquire 规则）

## 目录

```
app/          页面（收件箱/写信/信详情/来往/邮票册/书房/设置/登录/注册）
app/api/      天气 API（代理 Open-Meteo + Nominatim）
components/   UI 组件（信卡/官戳/私印/头像/邮票/点赞/评论/留言/写信表单）
lib/          db（schema+种子）、auth（JWT）、delivery（邮资/状态机）、stamps、weather、actions
data/         manifest.json + quotes.json（从 ../assets 拷贝）
public/assets 素材库（邮票/小人/背景/插图，由 tools/ 后处理脚本生成）
data/local.db SQLite 数据库（自动建表与种子）
```

## 部署说明（海外先上线）

- Vercel：数据库换 Turso（`MDJ_DB=libsql://...`，@libsql/client 无缝切换），
  定时任务用 Vercel Cron 跑「送达检查」（当前为请求时懒计算，规模大后再换）。
- 邮件：接入 Resend（私信送达/每日汇总通知，当前未接）。
- 环境变量：`MDJ_SECRET`（JWT 密钥，必改）、`MDJ_ADMIN_PASS`、`MDJ_DB`。

## 已知待办（见 ../docs/慢递局-产品设计文档.md）

- 同题共写（题池 + 轮值邮差）、邮务司发行历、节气/节日限时发行与首日戳
- 汉服小人捏脸编辑器（当前 12 预设）、邮件通知、明信片/时光胶囊（v2）
