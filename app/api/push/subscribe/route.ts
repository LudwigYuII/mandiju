import { validPushEndpoint } from "@/lib/push-policy";
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
    return Response.json(
      { ok: false, error: "请求体不是合法 JSON" },
      { status: 400 },
    );
  }

  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  const p256dh = typeof body?.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const auth = typeof body?.keys?.auth === "string" ? body.keys.auth : "";
  if (
    !validPushEndpoint(endpoint) ||
    !/^[A-Za-z0-9_-]{80,100}$/.test(p256dh) ||
    !/^[A-Za-z0-9_-]{20,30}$/.test(auth)
  ) {
    return Response.json(
      { ok: false, error: "订阅信息不完整" },
      { status: 400 },
    );
  }

  const tx = await db.transaction("write");
  try {
    const old = (
      await tx.execute({
        sql: "SELECT user_id FROM push_subs WHERE endpoint=?",
        args: [endpoint],
      })
    ).rows[0];
    if (old && String(old.user_id) !== sess.uid) {
      await tx.rollback();
      return Response.json({ error: "订阅不可修改" }, { status: 403 });
    }
    await tx.execute({
      sql: "DELETE FROM push_subs WHERE endpoint=? AND user_id=?",
      args: [endpoint, sess.uid],
    });
    await tx.execute({
      sql: "INSERT INTO push_subs(id,user_id,endpoint,p256dh,auth,created_at) VALUES(?,?,?,?,?,?)",
      args: [crypto.randomUUID(), sess.uid, endpoint, p256dh, auth, Date.now()],
    });
    await tx.commit();
  } catch {
    await tx.rollback();
    return Response.json({ error: "订阅未保存" }, { status: 500 });
  } finally {
    tx.close();
  }
  return Response.json({ ok: true });
}
