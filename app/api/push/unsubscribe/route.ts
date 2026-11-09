import { db, waitDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 取消订阅：body { endpoint }
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
    body = {};
  }
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  if (!endpoint) {
    return Response.json({ ok: false, error: "缺少 endpoint" }, { status: 400 });
  }

  await db.execute({
    sql: "DELETE FROM push_subs WHERE endpoint=? AND user_id=?",
    args: [endpoint, sess.uid],
  });

  return Response.json({ ok: true });
}
