import { NextResponse } from "next/server";
import { getHealthReport } from "@/lib/health";

// 健康检查：GET /api/health
//   · 无需登录（给外部探活 / 冒烟脚本 / 站长看）
//   · 只返回状态、耗时、表计数与「配置是否就绪」的布尔值，不含任何密钥值或用户隐私数据
//   · DB 不通时返回 503 且 ok:false
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// 统一 no-store：探活结果不能进 CDN/浏览器缓存（否则挂了也看不出来）
const NO_STORE = "no-store, no-cache, must-revalidate, max-age=0";

/** 公开响应只保留「外部探活」需要的部分，抹掉站长密码/密钥/DB 令牌这类配置姿态的布尔位 */
function publicReport(report: Awaited<ReturnType<typeof getHealthReport>>) {
  const c = report.config;
  return {
    ...report,
    config: {
      mail: c.mail,
      mailFrom: c.mailFrom,
      push: c.push,
      vapid: c.vapid,
      r2: c.r2,
    },
  };
}

export async function GET() {
  const report = await getHealthReport();
  return NextResponse.json(publicReport(report), {
    status: report.ok ? 200 : 503,
    headers: {
      "Cache-Control": NO_STORE,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

// 为了让 `curl -I /api/health` 这类探活也拿到真实状态码（Next 不会自动为 route handler 生成 HEAD）
export async function HEAD() {
  const report = await getHealthReport();
  return new NextResponse(null, {
    status: report.ok ? 200 : 503,
    headers: {
      "Cache-Control": NO_STORE,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
