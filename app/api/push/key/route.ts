export const dynamic = "force-dynamic";

// 返回 VAPID 公钥（公钥本身可公开，无需登录）
export async function GET() {
  return Response.json({ publicKey: process.env.MDJ_VAPID_PUBLIC || "" });
}
