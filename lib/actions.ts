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
import type { WeatherInfo } from "./weather";

export type ActionState = { error?: string; ok?: boolean };

function needText(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
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

  if (!["letter", "daily", "poem", "postcard"].includes(genre)) return { error: "请选择体裁" };
  if (!city) return { error: "请填写城市名（官戳要盖章）" };
  if (!stampId) return { error: "请选择一枚邮票" };

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
    if (!image.startsWith("uploads/")) return { error: "图片无效" };
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
    const r = await db.execute({ sql: "SELECT id FROM users WHERE pen_name=?", args: [recipientPen] });
    if (r.rows.length === 0) return { error: "收件人不存在" };
    recipientId = String((r.rows[0] as any).id);
    if (recipientId === sess.uid) return { error: "信不能寄给自己" };
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
    sql: `INSERT INTO letters(id, author_id, recipient_id, genre, title, body, postage, stamp_id, weather, city, temp, cost, image, first_day, reply_to, sent_at, deliver_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
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
  if (!upload.startsWith("uploads/")) return { error: "无效文件" };
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
  await db.execute({
    sql: `INSERT INTO drafts(id, user_id, genre, title, body, postage, stamp_id, recipient, city, weather, image, capsule_date, topic_id, reply_to, updated_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET genre=excluded.genre, title=excluded.title, body=excluded.body,
            postage=excluded.postage, stamp_id=excluded.stamp_id, recipient=excluded.recipient,
            city=excluded.city, weather=excluded.weather, image=excluded.image,
            capsule_date=excluded.capsule_date, topic_id=excluded.topic_id, reply_to=excluded.reply_to,
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
