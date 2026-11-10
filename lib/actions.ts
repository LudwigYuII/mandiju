"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { db, waitDb } from "./db";
import { createSession, clearSession, getSession } from "./auth";
import { deliverAt, postageCost } from "./delivery";
import { availableStamps, applySendGrants, weatherCodeToStampId, grantStamp, isSeasonalStamp } from "./stamps";
import { monthKey, monthStamp, currentHost, getCurrentTopic, getTopicById } from "./topics";
import { todayFirstDay } from "./calendar";
import { notify } from "./notify";
import { sendMail } from "./mail";
import { canWriteTo } from "./friends";
import { rateLimit, tooManyText } from "./rate-limit";
import { BURN_OPTIONS } from "./burn";
import { wipeBurn } from "./burn-db";
import type { WeatherInfo } from "./weather";

export type ActionState = { error?: string; ok?: boolean };

function needText(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

/** 校验「上传图片引用」：本地 uploads/ 相对路径，或 R2 的 http(s) 绝对地址 */
function isUploadRef(v: string): boolean {
  if (!v) return false;
  const p = v.startsWith("upload:") ? v.slice(7) : v;
  if (!/\.(jpe?g|png|webp|gif)$/i.test(p)) return false;
  return p.startsWith("uploads/") || /^https?:\/\//i.test(p);
}

// ---------- 注册 ----------
export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await waitDb();
  const code = needText(formData.get("code"));
  const email = needText(formData.get("email")).toLowerCase();
  const pen = needText(formData.get("pen"));
  const pass = needText(formData.get("password"));
  const birthday = needText(formData.get("birthday"));
  const seal = needText(formData.get("seal"));
  const avatarId = needText(formData.get("avatarId")) || "C01";
  const bgId = needText(formData.get("bgId")) || "D01";

  if (!code || !email || !pen || !pass) return { error: "请填写所有必填项" };
  if (pass.length < 6) return { error: "密码至少 6 位" };
  if (pen.length < 1 || pen.length > 12) return { error: "笔名 1–12 个字符" };
  if (!/^[\u4e00-\u9fa5]{1,2}$/.test(seal)) return { error: "私印需为 1–2 个汉字" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "邮箱格式不正确" };

  // 防批量刷邀请码：同一邮箱 1 小时内最多 3 次注册尝试
  const rl = await rateLimit(`register:${email}`, 3, 60 * 60 * 1000);
  if (!rl.ok) return { error: tooManyText(rl.retryAfter) };

  const inv = await db.execute({
    sql: "SELECT id FROM invites WHERE code=? AND used_by IS NULL LIMIT 1",
    args: [code],
  });
  if (inv.rows.length === 0) return { error: "邀请码无效或已被使用" };

  const dupEmail = await db.execute({ sql: "SELECT id FROM users WHERE email=?", args: [email] });
  if (dupEmail.rows.length > 0) return { error: "该邮箱已注册" };
  const dupPen = await db.execute({ sql: "SELECT id FROM users WHERE pen_name=?", args: [pen] });
  if (dupPen.rows.length > 0) return { error: "该笔名已被占用" };

  const id = crypto.randomUUID();
  const hash = await bcrypt.hash(pass, 10);
  await db.execute({
    sql: "INSERT INTO users(id, email, pen_name, password_hash, birthday, seal_text, avatar_id, bg_id, coins, last_coin_at, created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
    args: [id, email, pen, hash, birthday || null, seal, avatarId, bgId, 500, Date.now(), Date.now()],
  });
  await db.execute({
    sql: "UPDATE invites SET used_by=?, used_at=? WHERE code=?",
    args: [id, Date.now(), code],
  });

  await createSession(id, pen);
  redirect("/");
}

// ---------- 登录 ----------
export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await waitDb();
  const email = needText(formData.get("email")).toLowerCase();
  const pass = needText(formData.get("password"));
  if (!email || !pass) return { error: "请填写邮箱和密码" };

  // 防密码爆破：同一邮箱 10 分钟内最多 8 次尝试
  const rl = await rateLimit(`login:${email}`, 8, 10 * 60 * 1000);
  if (!rl.ok) return { error: tooManyText(rl.retryAfter) };

  const r = await db.execute({ sql: "SELECT * FROM users WHERE email=?", args: [email] });
  const u = r.rows[0] as any;
  if (!u || !(await bcrypt.compare(pass, String(u.password_hash)))) {
    return { error: "邮箱或密码不正确" };
  }
  await createSession(String(u.id), String(u.pen_name));
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect("/");
}

// ---------- 写信 ----------
export async function createLetterAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await waitDb();
  const sess = await getSession();
  if (!sess) redirect("/login");

  const meBan = await db.execute({ sql: "SELECT banned FROM users WHERE id=?", args: [sess.uid] });
  if (Number((meBan.rows[0] as any)?.banned) === 1) return { error: "你的账号已被暂停寄信" };

  // 防刷屏：同一账号 1 小时内最多寄 30 封
  const rl = await rateLimit(`write:${sess.uid}`, 30, 60 * 60 * 1000);
  if (!rl.ok) return { error: tooManyText(rl.retryAfter) };

  const recipientPen = needText(formData.get("recipient"));
  const genre = needText(formData.get("genre"));
  const title = needText(formData.get("title"));
  const body = needText(formData.get("body"));
  const postage = needText(formData.get("postage"));
  const stampId = needText(formData.get("stampId"));
  const city = needText(formData.get("city"));
  const weatherRaw = needText(formData.get("weather"));
  const topicId = needText(formData.get("topicId"));
  const image = needText(formData.get("image"));
  const capsuleRaw = needText(formData.get("capsuleDate"));
  const replyTo = needText(formData.get("replyTo"));
  const draftId = needText(formData.get("draftId"));
  const burnSecondsRaw = needText(formData.get("burnSeconds"));
  const sealColor = needText(formData.get("sealColor")) || "vermilion";
  const sealPattern = needText(formData.get("sealPattern")) || "plain";
  const paper = needText(formData.get("paper")) || "plain";
  const verticalRaw = needText(formData.get("vertical"));

  if (!["letter", "daily", "poem", "postcard"].includes(genre)) return { error: "请选择体裁" };
  if (!city) return { error: "请填写城市名（官戳要盖章）" };
  if (!stampId) return { error: "请选择一枚邮票" };
  if (!["vermilion", "indigo", "ink", "jade"].includes(sealColor)) return { error: "火漆颜色无效" };
  if (!["plain", "wave", "star", "rings"].includes(sealPattern)) return { error: "火漆纹样无效" };
  if (!["plain", "xuan", "gold", "night"].includes(paper)) return { error: "信纸样式无效" };

  // 时光胶囊：寄给未来的自己
  const isCapsule = recipientPen === "__future__";
  let capsuleAt = 0;
  if (isCapsule) {
    if (!title) return { error: "给未来的信需要标题" };
    const t = new Date(capsuleRaw);
    if (isNaN(t.getTime())) return { error: "请选择解锁日期" };
    if (t.getTime() <= Date.now()) return { error: "解锁日期必须在未来" };
    const max = Date.now() + 5 * 366 * 24 * 3600 * 1000;
    if (t.getTime() > max) return { error: "最多寄给五年后的自己" };
    capsuleAt = t.getTime();
  } else if (!title || !body) {
    return { error: "标题和正文不能为空" };
  }

  // 明信片：一张图 + 一句话
  if (genre === "postcard") {
    if (!image) return { error: "明信片需要一张图" };
    if (!isUploadRef(image)) return { error: "图片无效" };
    if (!body) return { error: "明信片需要一句话" };
  }

  let weather: WeatherInfo | null = null;
  if (weatherRaw) {
    try {
      weather = JSON.parse(weatherRaw);
    } catch {
      weather = null;
    }
  }

  // 邮票必须在可用清单里
  const stamps = await availableStamps(sess.uid);
  if (!stamps.some((s: any) => s.id === stampId)) return { error: "这枚邮票还不能用" };

  let recipientId: string | null = null;
  if (isCapsule) {
    recipientId = sess.uid; // 收件人是未来的自己
  } else if (recipientPen) {
    const r = await db.execute({
      sql: "SELECT id, banned FROM users WHERE pen_name=?",
      args: [recipientPen],
    });
    if (r.rows.length === 0) return { error: "收件人不存在" };
    recipientId = String((r.rows[0] as any).id);
    if (recipientId === sess.uid) return { error: "信不能寄给自己" };
    if (Number((r.rows[0] as any).banned) === 1) return { error: "对方暂时无法收信" };
    // 隐私守则：只有笔友（或曾来信者/站长）之间才能互寄
    if (!(await canWriteTo(sess.uid, recipientId))) {
      return { error: "你们还不是笔友，先去「笔友」页加好友吧" };
    }
  }

  // 阅后即焚：只能寄给指定笔友（公开信/时光胶囊不可焚）
  let burnSeconds: number | null = null;
  if (burnSecondsRaw) {
    if (!recipientId || isCapsule) return { error: "阅后即焚只能寄给某位笔友" };
    const n = Number(burnSecondsRaw);
    if (!(BURN_OPTIONS as readonly number[]).includes(n)) return { error: "焚毁倒计时无效" };
    burnSeconds = n;
  }

  // 回信：校验原信存在
  let replyTitle: string | null = null;
  if (replyTo) {
    const orig = await db.execute({ sql: "SELECT id, title FROM letters WHERE id=?", args: [replyTo] });
    if (orig.rows.length === 0) return { error: "原信不存在" };
    replyTitle = String((orig.rows[0] as any).title);
  }

  const id = crypto.randomUUID();
  const now = Date.now();
  const cost = isCapsule ? 0 : postageCost(postage);

  // 扣费（胶囊免费）
  const me = await db.execute({ sql: "SELECT coins FROM users WHERE id=?", args: [sess.uid] });
  const coins = Number((me.rows[0] as any)?.coins ?? 0);
  if (!isCapsule && coins < cost) {
    return { error: `「文」不足：寄${postageCostLabel(postage)}需要 ${cost} 文，当前余额 ${coins} 文` };
  }

  // 首日戳
  const firstDay = todayFirstDay();
  const deliverMs = isCapsule ? capsuleAt : deliverAt(postage, now);

  await db.execute({
    sql: `INSERT INTO letters(id, author_id, recipient_id, genre, title, body, postage, stamp_id, weather, city, temp, cost, image, first_day, reply_to, sent_at, deliver_at, burn_seconds, seal_color, seal_pattern, paper, vertical)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      id, sess.uid, recipientId, genre,
      title || (genre === "postcard" ? "明信片" : "无题"),
      body,
      isCapsule ? "capsule" : postage,
      stampId,
      weather ? weatherLabelCode(weather.code) : null,
      city,
      weather?.temp ?? null,
      cost,
      genre === "postcard" ? image : null,
      firstDay ? 1 : 0,
      replyTo || null,
      now,
      deliverMs,
      burnSeconds,
      sealColor,
      sealPattern,
      paper,
      verticalRaw === "1" ? 1 : 0,
    ],
  });
  if (draftId) {
    await db.execute({ sql: "DELETE FROM drafts WHERE id=? AND user_id=?", args: [draftId, sess.uid] });
  }
  if (!isCapsule) {
    await db.execute({ sql: "UPDATE users SET coins = coins - ? WHERE id=?", args: [cost, sess.uid] });
  }

  const u = await db.execute({ sql: "SELECT letters_sent FROM users WHERE id=?", args: [sess.uid] });
  const sent = Number((u.rows[0] as any).letters_sent) + 1;
  await db.execute({ sql: "UPDATE users SET letters_sent=? WHERE id=?", args: [sent, sess.uid] });

  // 每满 10 封信，自动获得 3 枚邀请码
  if (sent % 10 === 0) {
    for (let i = 0; i < 3; i++) {
      await db.execute({
        sql: "INSERT INTO invites(id, code, created_by, created_at) VALUES(?,?,?,?)",
        args: [crypto.randomUUID(), makeInviteCode(), sess.uid, Date.now()],
      });
    }
  }

  const weatherStamp = weather ? weatherCodeToStampId(weather.code, weather.gust) : null;
  await applySendGrants(sess.uid, sent, weatherStamp);

  // 使用即解锁：当年限定票（节气/节日）用这枚票寄出即入藏
  const season = isSeasonalStamp(stampId);
  if (season) {
    await grantStamp(sess.uid, stampId, `发行纪念·${season.name}`);
  }

  // 同题共写：关联主题并解锁当月纪念票
  if (topicId) {
    const topic = await getTopicById(topicId);
    if (topic && String(topic.month) === monthKey()) {
      await db.execute({
        sql: "INSERT OR IGNORE INTO topic_letters(letter_id, topic_id) VALUES(?,?)",
        args: [id, topicId],
      });
      await grantStamp(sess.uid, String(topic.stamp_id), `同题共写·${monthKey()}`);
    }
  }

  revalidatePath("/");
  redirect(`/letter/${id}`);
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function makeInviteCode(): string {
  let s = "";
  for (let i = 0; i < 10; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

function weatherLabelCode(code: number | null): string | null {
  if (code == null) return null;
  return String(code);
}

function postageCostLabel(id: string): string {
  return id === "air" ? "急递" : id === "surface" ? "平信" : "慢信";
}

// ---------- 修改私印 ----------
export async function updateSealAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await waitDb();
  const sess = await getSession();
  if (!sess) redirect("/login");
  const seal = needText(formData.get("seal"));
  if (!/^[\u4e00-\u9fa5]{1,2}$/.test(seal)) return { error: "私印需为 1–2 个汉字" };
  await db.execute({ sql: "UPDATE users SET seal_text=? WHERE id=?", args: [seal, sess.uid] });
  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true };
}

// ---------- 修改官方头像（小人+背景） ----------
export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await waitDb();
  const sess = await getSession();
  if (!sess) redirect("/login");
  const avatarId = needText(formData.get("avatarId")) || "C01";
  const bgId = needText(formData.get("bgId")) || "D01";

  // 小人只接受官方预设编号
  if (!/^C\d{2}$/.test(avatarId)) return { error: "无效的小人编号" };
  // 背景：官方预设（D 开头）或用户上传的图片（upload:<本地路径或 R2 地址>）
  const isPresetBg = /^D\d{2}$/.test(bgId);
  const isUploadBg = bgId.startsWith("upload:") && isUploadRef(bgId);
  if (!isPresetBg && !isUploadBg) return { error: "无效的背景图片" };

  await db.execute({
    sql: "UPDATE users SET avatar_id=?, bg_id=? WHERE id=?",
    args: [avatarId, bgId, sess.uid],
  });
  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true };
}

// ---------- 使用上传头像 ----------
export async function updateUploadAvatarAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await waitDb();
  const sess = await getSession();
  if (!sess) redirect("/login");
  const upload = needText(formData.get("upload"));
  if (!isUploadRef(upload)) return { error: "无效文件" };
  await db.execute({
    sql: "UPDATE users SET avatar_id=? WHERE id=?",
    args: [`upload:${upload}`, sess.uid],
  });
  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true };
}

// ---------- 评论 ----------
export async function addReplyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await waitDb();
  const sess = await getSession();
  if (!sess) redirect("/login");
  const letterId = needText(formData.get("letterId"));
  const body = needText(formData.get("body"));
  if (!letterId || !body) return { error: "评论不能为空" };
  await db.execute({
    sql: "INSERT INTO replies(id, letter_id, author_id, body, created_at) VALUES(?,?,?,?,?)",
    args: [crypto.randomUUID(), letterId, sess.uid, body, Date.now()],
  });
  const l = await db.execute({ sql: "SELECT author_id, title FROM letters WHERE id=?", args: [letterId] });
  const authorId = String((l.rows[0] as any)?.author_id ?? "");
  if (authorId && authorId !== sess.uid) {
    await notify(authorId, "reply", `有人在《${String((l.rows[0] as any).title)}》下批注了你的信`, `/letter/${letterId}`);
  }
  revalidatePath(`/letter/${letterId}`);
  return { ok: true };
}

// ---------- 贴邮票点赞 ----------
export async function toggleLikeAction(formData: FormData): Promise<void> {
  await waitDb();
  const sess = await getSession();
  if (!sess) redirect("/login");
  const letterId = needText(formData.get("letterId"));
  if (!letterId) return;
  const existing = await db.execute({
    sql: "SELECT 1 FROM likes WHERE letter_id=? AND user_id=?",
    args: [letterId, sess.uid],
  });
  if (existing.rows.length > 0) {
    await db.execute({ sql: "DELETE FROM likes WHERE letter_id=? AND user_id=?", args: [letterId, sess.uid] });
  } else {
    await db.execute({
      sql: "INSERT INTO likes(letter_id, user_id, created_at) VALUES(?,?,?)",
      args: [letterId, sess.uid, Date.now()],
    });
    const l = await db.execute({ sql: "SELECT author_id, title FROM letters WHERE id=?", args: [letterId] });
    const authorId = String((l.rows[0] as any)?.author_id ?? "");
    if (authorId && authorId !== sess.uid) {
      await notify(authorId, "like", `有人给你的《${String((l.rows[0] as any).title)}》贴了一枚邮票`, `/letter/${letterId}`);
    }
  }
  revalidatePath(`/letter/${letterId}`);
}

// ---------- 站长：生成邀请码 ----------
export async function generateInvitesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await waitDb();
  const sess = await getSession();
  if (!sess) redirect("/login");
  const me = await db.execute({ sql: "SELECT role FROM users WHERE id=?", args: [sess.uid] });
  if (String((me.rows[0] as any)?.role) !== "admin") return { error: "只有站长能生成邀请码" };
  const n = Math.min(10, Math.max(1, Number(needText(formData.get("count")) || "5")));
  for (let i = 0; i < n; i++) {
    await db.execute({
      sql: "INSERT INTO invites(id, code, created_by, created_at) VALUES(?,?,?,?)",
      args: [crypto.randomUUID(), makeInviteCode(), sess.uid, Date.now()],
    });
  }
  revalidatePath("/settings");
  return { ok: true };
}

// ---------- 同题共写：投题 ----------
export async function proposeTopicAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await waitDb();
  const sess = await getSession();
  if (!sess) redirect("/login");
  const title = needText(formData.get("title"));
  if (!title) return { error: "写一个选题吧" };
  if (title.length > 40) return { error: "选题最多 40 字" };
  await db.execute({
    sql: "INSERT INTO topic_pool(id, proposer_id, title, created_at) VALUES(?,?,?,?)",
    args: [crypto.randomUUID(), sess.uid, title, Date.now()],
  });
  revalidatePath("/topics");
  return { ok: true };
}

// ---------- 同题共写：挂出本月主题（站长或轮值邮差） ----------
export async function createTopicAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await waitDb();
  const sess = await getSession();
  if (!sess) redirect("/login");
  const host = await currentHost();
  const me = await db.execute({ sql: "SELECT role FROM users WHERE id=?", args: [sess.uid] });
  const isAdmin = String((me.rows[0] as any)?.role) === "admin";
  if (!host || (sess.uid !== host.id && !isAdmin)) return { error: "只有站长或本月轮值邮差能挂出主题" };

  const existing = await getCurrentTopic();
  if (existing) return { error: "本月主题已挂出" };

  const poolId = needText(formData.get("poolId"));
  let title = needText(formData.get("title"));
  if (poolId) {
    const p = await db.execute({ sql: "SELECT title FROM topic_pool WHERE id=? AND status='pending'", args: [poolId] });
    if (p.rows.length === 0) return { error: "该选题不可用" };
    title = String((p.rows[0] as any).title);
    await db.execute({ sql: "UPDATE topic_pool SET status='used' WHERE id=?", args: [poolId] });
  }
  if (!title) return { error: "请填写主题或从题池选择" };
  if (title.length > 40) return { error: "主题最多 40 字" };

  const stamp = monthStamp();
  if (!stamp) return { error: "本月没有限定邮票" };
  await db.execute({
    sql: "INSERT INTO topics(id, month, title, stamp_id, host_id, created_at) VALUES(?,?,?,?,?,?)",
    args: [crypto.randomUUID(), monthKey(), title, stamp.id, sess.uid, Date.now()],
  });
  revalidatePath("/topics");
  revalidatePath("/bureau");
  return { ok: true };
}

// ---------- 同题共写：撤回自己的投题 ----------
export async function withdrawTopicAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await waitDb();
  const sess = await getSession();
  if (!sess) redirect("/login");
  const poolId = needText(formData.get("poolId"));
  const r = await db.execute({
    sql: "SELECT proposer_id, status FROM topic_pool WHERE id=?",
    args: [poolId],
  });
  const row = r.rows[0] as any;
  if (!row) return { error: "该投题不存在" };
  if (String(row.proposer_id) !== sess.uid) return { error: "只能撤回自己的投题" };
  if (String(row.status) !== "pending") return { error: "该投题已使用" };
  await db.execute({ sql: "DELETE FROM topic_pool WHERE id=?", args: [poolId] });
  revalidatePath("/topics");
  return { ok: true };
}

// ---------- 草稿箱 ----------
export async function saveDraftAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await waitDb();
  const sess = await getSession();
  if (!sess) redirect("/login");
  const genre = needText(formData.get("genre")) || "letter";
  const title = needText(formData.get("title"));
  const body = needText(formData.get("body"));
  if (!title && !body) return { error: "空草稿不值得保存" };
  const draftId = needText(formData.get("draftId"));
  const id = draftId || crypto.randomUUID();
  const burnRaw = needText(formData.get("burnSeconds"));
  const burnSeconds =
    burnRaw && (BURN_OPTIONS as readonly number[]).includes(Number(burnRaw)) ? Number(burnRaw) : null;
  const sealColor = ["vermilion", "indigo", "ink", "jade"].includes(needText(formData.get("sealColor")))
    ? needText(formData.get("sealColor"))
    : null;
  const sealPattern = ["plain", "wave", "star", "rings"].includes(needText(formData.get("sealPattern")))
    ? needText(formData.get("sealPattern"))
    : null;
  const paper = ["plain", "xuan", "gold", "night"].includes(needText(formData.get("paper")))
    ? needText(formData.get("paper"))
    : null;
  const vertical = needText(formData.get("vertical")) === "1" ? 1 : null;
  await db.execute({
    sql: `INSERT INTO drafts(id, user_id, genre, title, body, postage, stamp_id, recipient, city, weather, image, capsule_date, topic_id, reply_to, burn_seconds, seal_color, seal_pattern, paper, vertical, updated_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET genre=excluded.genre, title=excluded.title, body=excluded.body,
            postage=excluded.postage, stamp_id=excluded.stamp_id, recipient=excluded.recipient,
            city=excluded.city, weather=excluded.weather, image=excluded.image,
            capsule_date=excluded.capsule_date, topic_id=excluded.topic_id, reply_to=excluded.reply_to,
            burn_seconds=excluded.burn_seconds, seal_color=excluded.seal_color,
            seal_pattern=excluded.seal_pattern, paper=excluded.paper, vertical=excluded.vertical,
            updated_at=excluded.updated_at`,
    args: [
      id, sess.uid, genre, title || null, body || null,
      needText(formData.get("postage")) || null,
      needText(formData.get("stampId")) || null,
      needText(formData.get("recipient")) || null,
      needText(formData.get("city")) || null,
      needText(formData.get("weather")) || null,
      needText(formData.get("image")) || null,
      needText(formData.get("capsuleDate")) || null,
      needText(formData.get("topicId")) || null,
      needText(formData.get("replyTo")) || null,
      burnSeconds,
      sealColor,
      sealPattern,
      paper,
      vertical,
      Date.now(),
    ],
  });
  revalidatePath("/write");
  return { ok: true, draftId: id } as any;
}

export async function deleteDraftAction(formData: FormData): Promise<void> {
  await waitDb();
  const sess = await getSession();
  if (!sess) redirect("/login");
  const draftId = needText(formData.get("draftId"));
  if (!draftId) return;
  await db.execute({ sql: "DELETE FROM drafts WHERE id=? AND user_id=?", args: [draftId, sess.uid] });
  revalidatePath("/write");
}

// ---------- 通知 ----------
export async function markNotificationAction(formData: FormData): Promise<void> {
  await waitDb();
  const sess = await getSession();
  if (!sess) redirect("/login");
  const id = needText(formData.get("id"));
  const link = needText(formData.get("link"));
  await db.execute({
    sql: "UPDATE notifications SET read=1 WHERE id=? AND user_id=?",
    args: [id, sess.uid],
  });
  revalidatePath("/notifications");
  if (link) redirect(link);
}

export async function markAllNotificationsAction(): Promise<void> {
  await waitDb();
  const sess = await getSession();
  if (!sess) redirect("/login");
  await db.execute({
    sql: "UPDATE notifications SET read=1 WHERE user_id=? AND read=0",
    args: [sess.uid],
  });
  revalidatePath("/notifications");
}

// ---------- 找回密码 ----------
export async function forgotPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await waitDb();
  const email = needText(formData.get("email")).toLowerCase();
  // 防验证码轰炸：同一邮箱 1 小时内最多 3 次
  const rl = await rateLimit(`forgot:${email}`, 3, 60 * 60 * 1000);
  if (!rl.ok) return { error: tooManyText(rl.retryAfter) };
  const u = await db.execute({ sql: "SELECT id FROM users WHERE email=?", args: [email] });
  if (u.rows.length === 0) return { error: "该邮箱未注册" };
  const uid = String((u.rows[0] as any).id);
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await db.execute({ sql: "DELETE FROM password_resets WHERE user_id=?", args: [uid] });
  await db.execute({
    sql: "INSERT INTO password_resets(id, user_id, code, expires_at, created_at) VALUES(?,?,?,?,?)",
    args: [crypto.randomUUID(), uid, code, Date.now() + 15 * 60 * 1000, Date.now()],
  });
  await sendMail(email, "慢递局 · 重置密码验证码", `你的验证码是 ${code}，15 分钟内有效。`);
  return { ok: true };
}

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await waitDb();
  const email = needText(formData.get("email")).toLowerCase();
  const code = needText(formData.get("code"));
  const pass = needText(formData.get("password"));
  if (pass.length < 6) return { error: "密码至少 6 位" };
  // 防验证码穷举：同一邮箱 15 分钟内最多 10 次
  const rl = await rateLimit(`reset:${email}`, 10, 15 * 60 * 1000);
  if (!rl.ok) return { error: tooManyText(rl.retryAfter) };
  const u = await db.execute({ sql: "SELECT id FROM users WHERE email=?", args: [email] });
  if (u.rows.length === 0) return { error: "邮箱未注册" };
  const uid = String((u.rows[0] as any).id);
  const r = await db.execute({
    sql: "SELECT id FROM password_resets WHERE user_id=? AND code=? AND used=0 AND expires_at > ?",
    args: [uid, code, Date.now()],
  });
  if (r.rows.length === 0) return { error: "验证码错误或已过期" };
  const hash = await bcrypt.hash(pass, 10);
  await db.execute({ sql: "UPDATE users SET password_hash=? WHERE id=?", args: [hash, uid] });
  await db.execute({ sql: "UPDATE password_resets SET used=1 WHERE id=?", args: [String((r.rows[0] as any).id)] });
  redirect("/login");
}

// ---------- 留言墙 ----------
export async function addNoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await waitDb();
  const sess = await getSession();
  if (!sess) redirect("/login");
  const body = needText(formData.get("body"));
  if (!body) return { error: "写点什么吧" };
  if (body.length > 120) return { error: "便签最多 120 字" };
  await db.execute({
    sql: "INSERT INTO notes(id, author_id, body, created_at) VALUES(?,?,?,?)",
    args: [crypto.randomUUID(), sess.uid, body, Date.now()],
  });
  await db.execute(`
    UPDATE notes SET archived=1
    WHERE archived=0 AND id NOT IN (
      SELECT id FROM notes WHERE archived=0 ORDER BY created_at DESC LIMIT 30
    )`);
  revalidatePath("/");
  return { ok: true };
}

// ---------- 好友系统 ----------
async function requireUser(): Promise<{ uid: string; pen: string }> {
  const sess = await getSession();
  if (!sess) redirect("/login");
  return sess;
}

export async function sendFriendRequestAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await waitDb();
  const sess = await requireUser();
  const targetId = needText(formData.get("targetId"));
  if (!targetId) return { error: "没有找到这位笔友" };
  if (targetId === sess.uid) return { error: "不能加自己为好友" };

  const t = await db.execute({
    sql: "SELECT id, pen_name, banned FROM users WHERE id=?",
    args: [targetId],
  });
  if (t.rows.length === 0) return { error: "这位笔友不存在" };
  if (Number((t.rows[0] as any).banned) === 1) return { error: "这位笔友暂时无法添加" };

  const existing = await db.execute({
    sql: "SELECT status, requester_id FROM friends WHERE (requester_id=? AND addressee_id=?) OR (requester_id=? AND addressee_id=?) LIMIT 1",
    args: [sess.uid, targetId, targetId, sess.uid],
  });
  const row = existing.rows[0] as any;
  if (row) {
    if (String(row.status) === "accepted") return { error: "你们已经是笔友了" };
    if (String(row.requester_id) === sess.uid) return { error: "申请已寄出，等对方回音" };
    return { error: "对方已经向你发过申请，去「笔友」页接受吧" };
  }

  await db.execute({
    sql: "INSERT INTO friends(requester_id, addressee_id, status, created_at) VALUES(?,?,'pending',?)",
    args: [sess.uid, targetId, Date.now()],
  });
  await notify(
    targetId,
    "friend",
    `${sess.pen} 想和你成为笔友`,
    "/friends"
  );
  revalidatePath("/friends");
  return { ok: true };
}

export async function acceptFriendAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await waitDb();
  const sess = await requireUser();
  const requesterId = needText(formData.get("requesterId"));
  const r = await db.execute({
    sql: "SELECT requester_id FROM friends WHERE requester_id=? AND addressee_id=? AND status='pending'",
    args: [requesterId, sess.uid],
  });
  if (r.rows.length === 0) return { error: "申请不存在或已处理" };
  await db.execute({
    sql: "UPDATE friends SET status='accepted', accepted_at=? WHERE requester_id=? AND addressee_id=?",
    args: [Date.now(), requesterId, sess.uid],
  });
  await notify(requesterId, "friend", `${sess.pen} 接受了你的笔友申请，可以互相写信了`, "/friends");
  revalidatePath("/friends");
  revalidatePath("/write");
  return { ok: true };
}

export async function declineFriendAction(formData: FormData): Promise<void> {
  await waitDb();
  const sess = await requireUser();
  const requesterId = needText(formData.get("requesterId"));
  await db.execute({
    sql: "DELETE FROM friends WHERE requester_id=? AND addressee_id=? AND status='pending'",
    args: [requesterId, sess.uid],
  });
  revalidatePath("/friends");
}

export async function removeFriendAction(formData: FormData): Promise<void> {
  await waitDb();
  const sess = await requireUser();
  const otherId = needText(formData.get("otherId"));
  await db.execute({
    sql: "DELETE FROM friends WHERE (requester_id=? AND addressee_id=?) OR (requester_id=? AND addressee_id=?)",
    args: [sess.uid, otherId, otherId, sess.uid],
  });
  revalidatePath("/friends");
  revalidatePath("/write");
}

// ---------- 生日 ----------
export async function updateBirthdayAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await waitDb();
  const sess = await requireUser();
  const birthday = needText(formData.get("birthday"));
  if (birthday && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return { error: "生日格式不正确" };
  await db.execute({
    sql: "UPDATE users SET birthday=? WHERE id=?",
    args: [birthday || null, sess.uid],
  });
  revalidatePath("/settings");
  return { ok: true };
}

// ---------- 站长工具 ----------
async function requireAdmin(): Promise<{ uid: string; pen: string }> {
  const sess = await requireUser();
  const me = await db.execute({ sql: "SELECT role FROM users WHERE id=?", args: [sess.uid] });
  if (String((me.rows[0] as any)?.role) !== "admin") redirect("/");
  return sess;
}

export async function adminDeleteLetterAction(formData: FormData): Promise<void> {
  await waitDb();
  await requireAdmin();
  const letterId = needText(formData.get("letterId"));
  if (!letterId) return;
  await db.execute({ sql: "DELETE FROM likes WHERE letter_id=?", args: [letterId] });
  await db.execute({ sql: "DELETE FROM replies WHERE letter_id=?", args: [letterId] });
  await db.execute({ sql: "DELETE FROM topic_letters WHERE letter_id=?", args: [letterId] });
  await db.execute({ sql: "DELETE FROM letters WHERE id=?", args: [letterId] });
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function adminToggleBanAction(formData: FormData): Promise<void> {
  await waitDb();
  await requireAdmin();
  const userId = needText(formData.get("userId"));
  const u = await db.execute({ sql: "SELECT banned, role FROM users WHERE id=?", args: [userId] });
  if (u.rows.length === 0) return;
  const row = u.rows[0] as any;
  if (String(row.role) === "admin") return; // 站长不可封禁
  const next = Number(row.banned) === 1 ? 0 : 1;
  await db.execute({ sql: "UPDATE users SET banned=? WHERE id=?", args: [next, userId] });
  revalidatePath("/admin");
}

export async function adminToggleRoleAction(formData: FormData): Promise<void> {
  await waitDb();
  await requireAdmin();
  const userId = needText(formData.get("userId"));
  const u = await db.execute({ sql: "SELECT role, banned FROM users WHERE id=?", args: [userId] });
  if (u.rows.length === 0) return;
  const row = u.rows[0] as any;
  if (Number(row.banned) === 1) return;
  const next = String(row.role) === "admin" ? "member" : "admin";
  if (next === "member") {
    // 防误操作：至少保留一位站长
    const admins = await db.execute({ sql: "SELECT COUNT(*) AS n FROM users WHERE role='admin'" });
    if (Number((admins.rows[0] as any)?.n ?? 0) <= 1) return;
  }
  await db.execute({ sql: "UPDATE users SET role=? WHERE id=?", args: [next, userId] });
  revalidatePath("/admin");
}

export async function createAnnouncementAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await waitDb();
  const sess = await requireAdmin();
  const body = needText(formData.get("body"));
  const pinned = needText(formData.get("pinned")) === "1" ? 1 : 0;
  if (!body) return { error: "公告内容不能为空" };
  if (body.length > 200) return { error: "公告最多 200 字" };
  await db.execute({
    sql: "INSERT INTO announcements(id, body, pinned, created_by, created_at) VALUES(?,?,?,?,?)",
    args: [crypto.randomUUID(), body, pinned, sess.uid, Date.now()],
  });
  revalidatePath("/admin");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteAnnouncementAction(formData: FormData): Promise<void> {
  await waitDb();
  await requireAdmin();
  const id = needText(formData.get("id"));
  await db.execute({ sql: "DELETE FROM announcements WHERE id=?", args: [id] });
  revalidatePath("/admin");
  revalidatePath("/");
}

/** 邮件通道自检：向指定邮箱发一封测试信，返回真实投递结果（站长专用） */
export async function sendTestMailAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await waitDb();
  const sess = await requireAdmin();
  const me = (await db.execute({ sql: "SELECT email FROM users WHERE id=?", args: [sess.uid] })).rows[0] as any;
  const to = needText(formData.get("to")) || String(me?.email ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { error: "请填写有效邮箱" };
  const rl = await rateLimit(`testmail:${sess.uid}`, 5, 30 * 60 * 1000);
  if (!rl.ok) return { error: tooManyText(rl.retryAfter) };

  const result = await sendMail(
    to,
    "慢递局 · 邮件通道自检",
    `这是一封自检邮件（${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}）。\n收到它说明慢递局的邮件通知通道已经打通：有人给你寄信、时光胶囊解锁、找回密码验证码都会通过这里送达。`
  );
  if (!result.ok) return { error: `发送失败：${result.error ?? "未知错误"}` };
  return { ok: true };
}

// ---------- 阅后即焚 ----------
export type BurnOpenResult =
  | { error: string }
  | { burned: true }
  | { ok: true; body: string; title: string; genre: string; deadline: number; seconds: number };

/** 收件人拆封：首次拆封启动倒计时并返回正文（唯一一次服务端下发），窗口内可重读，到期即焚 */
export async function openBurnLetterAction(letterId: string): Promise<BurnOpenResult> {
  await waitDb();
  const sess = await getSession();
  if (!sess) return { error: "请先登录" };
  const r = await db.execute({ sql: "SELECT * FROM letters WHERE id=?", args: [letterId] });
  const l = r.rows[0] as any;
  if (!l) return { error: "信不存在" };
  if (Number(l.burn_seconds ?? 0) <= 0) return { error: "这封信不是阅后即焚" };
  if (Number(l.burned) === 1) return { burned: true };
  if (String(l.recipient_id) !== sess.uid) return { error: "只有收件人能拆封" };
  if (Number(l.deliver_at) > Date.now()) return { error: "信还在路上，等它送达吧" };

  let burnedAt = Number(l.burned_at ?? 0);
  if (!burnedAt) {
    burnedAt = Date.now() + Number(l.burn_seconds) * 1000;
    await db.execute({
      sql: "UPDATE letters SET burned_at=?, read_at=? WHERE id=?",
      args: [burnedAt, Date.now(), letterId],
    });
  }
  if (Date.now() >= burnedAt) {
    await wipeBurn(letterId);
    return { burned: true };
  }
  return {
    ok: true,
    body: String(l.body),
    title: String(l.title),
    genre: String(l.genre),
    deadline: burnedAt,
    seconds: Number(l.burn_seconds),
  };
}

/** 倒计时归零时由客户端调用；服务器校验到期才真正抹除正文 */
export async function burnLetterAction(letterId: string): Promise<void> {
  await waitDb();
  const sess = await getSession();
  if (!sess) return;
  const r = await db.execute({
    sql: "SELECT burn_seconds, burned, burned_at, author_id, recipient_id FROM letters WHERE id=?",
    args: [letterId],
  });
  const l = r.rows[0] as any;
  if (!l || Number(l.burn_seconds ?? 0) <= 0 || Number(l.burned) === 1) return;
  if (String(l.author_id) !== sess.uid && String(l.recipient_id) !== sess.uid) return;
  if (Number(l.burned_at ?? 0) > 0 && Number(l.burned_at) <= Date.now()) {
    await wipeBurn(letterId);
  }
}

// ---------- 入站指引 ----------
export async function confirmOnboardAction(): Promise<void> {
  await waitDb();
  const sess = await getSession();
  if (!sess) redirect("/login");
  await db.execute({
    sql: "UPDATE users SET onboarded_at=? WHERE id=? AND onboarded_at IS NULL",
    args: [Date.now(), sess.uid],
  });
  revalidatePath("/");
  redirect("/");
}
