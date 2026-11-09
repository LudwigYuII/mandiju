import { db, waitDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 保存订阅：body { endpoint, keys: { p256dh, auth } }
export async function POST(req: Request) {
  await waitDb();
  const sess = await getSession();
  if (!sess) {
    return Response.json({ ok: false, error: "请先登录" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  const p256dh = typeof body?.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const auth = typeof body?.keys?.auth === "string" ? body.keys.auth : "";
  if (!endpoint.startsWith("https://") || !p256dh || !auth) {
    return Response.json({ ok: false, error: "订阅信息不完整" }, { status: 400 });
  }

  // 先删同 endpoint 旧记录再插入，避免重复订阅
  await db.execute({ sql: "DELETE FROM push_subs WHERE endpoint=?", args: [endpoint] });
  await db.execute({
    sql: "INSERT INTO push_subs(id, user_id, endpoint, p256dh, auth, created_at) VALUES(?,?,?,?,?,?)",
    args: [crypto.randomUUID(), sess.uid, endpoint, p256dh, auth, Date.now()],
  });

  return Response.json({ ok: true });
}
