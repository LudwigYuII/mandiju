import { getSession } from "@/lib/auth";
import { waitDb } from "@/lib/db";
import { unreadCount } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function GET() {
  await waitDb();
  const sess = await getSession();
  return Response.json({ count: sess ? await unreadCount(sess.uid) : 0 });
}
