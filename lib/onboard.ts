// 入站指引：新用户（onboarded_at 为空）先读规则才能进站
import { redirect } from "next/navigation";
import { db } from "./db";
import { getSession } from "./auth";

/** 首页/写信/往来/笔友页的入口闸门：未登录返回 null；未读入站指引则跳转 /onboard */
export async function gateOnboard() {
  const sess = await getSession();
  if (!sess) return null;
  const r = await db.execute({
    sql: "SELECT onboarded_at FROM users WHERE id=?",
    args: [sess.uid],
  });
  if (!Number((r.rows[0] as any)?.onboarded_at ?? 0)) redirect("/onboard");
  return sess;
}
