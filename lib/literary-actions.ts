"use server";
import { db, waitDb } from "./db";
import { getSession } from "./auth";
import { rateLimit } from "./rate-limit";
import { literaryMutation } from "./literary-service";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
export type LiteraryState = { ok?: boolean; error?: string };
export async function literaryAction(
  _: LiteraryState,
  form: FormData,
): Promise<LiteraryState> {
  await waitDb();
  const s = await getSession();
  if (!s) redirect("/login");
  if (!(await rateLimit(`literary-request:${s.uid}`, 60, 60000)).ok)
    return { error: "请稍后再试" };
  const data: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") data[k] = v;
  let result: { id?: string };
  try {
    result = await literaryMutation(db, s.uid, data.op, data);
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    return { error: /[\u4e00-\u9fff]/.test(m) ? m : "未能保存，请稍后重试" };
  }
  revalidatePath("/", "layout");
  if (data.op === "create" && result.id) redirect(`/literature/${result.id}`);
  return { ok: true };
}
