"use server";
import { db, waitDb } from "./db";
import { getSession } from "./auth";
import { rateLimit } from "./rate-limit";
import { studyMutation } from "./study-service";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { ActionState } from "./actions";
export async function studyAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  await waitDb();
  const session = await getSession();
  if (!session) redirect("/login");
  if (!(await rateLimit(`study:${session.uid}`, 60, 60000)).ok)
    return { error: "请稍后再试" };
  const values: Record<string, string> = {};
  for (const [key, value] of form.entries())
    if (typeof value === "string") values[key] = value;
  try {
    await studyMutation(db, session.uid, values.op, values);
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    // Database internals and raw SQL are never exposed as form errors.
    return {
      error: /[\u4e00-\u9fff]/.test(message) ? message : "未能保存，请稍后重试",
    };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
