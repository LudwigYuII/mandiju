import { NextRequest, NextResponse } from "next/server";
import { waitDb } from "@/lib/db";
import { sweepDelivered } from "@/lib/mail";
import { runDailyReminders } from "@/lib/reminders";
import { expireBurnLetters } from "@/lib/burn-db";

// 每日定时任务（Vercel Cron 触发，北京时间约 08:00）
// 注意：vercel.json 的 cron 无法配置自定义请求头，Vercel 触发时带 UA=vercel-cron/1.0；
// Bearer 校验保留给手动/调试触发（curl -H "Authorization: Bearer <MDJ_SECRET>"）。
export async function GET(req: NextRequest) {
  const ua = req.headers.get("user-agent") ?? "";
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  const isVercelCron = ua === "vercel-cron/1.0";
  const authOk = !!secret && auth === `Bearer ${secret}`;
  if (!authOk) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }
  await waitDb();
  try {
    await sweepDelivered();
    await runDailyReminders();
    await expireBurnLetters();
    return NextResponse.json({ ok: true, at: Date.now() });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "delivery_task_failed" },
      { status: 500 },
    );
  }
}
