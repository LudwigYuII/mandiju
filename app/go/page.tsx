import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db, waitDb } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { GoInvite } from '@/components/GoRoom';
import { UiText } from '@/components/UiText';

export const dynamic='force-dynamic';

export default async function GoLobby() {
  await waitDb();
  const me=await getSession();
  if (!me) redirect('/login');
  const {rows}=await db.execute({
    sql:`SELECT g.id, g.state, u.pen_name AS peer FROM go_games g JOIN public_users u
        ON u.id=CASE WHEN g.black_id=? THEN g.white_id ELSE g.black_id END
      WHERE (g.black_id=? OR g.white_id=?) AND u.banned=0
      AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE
        (b.blocker_id=u.id AND b.blocked_id=?) OR (b.blocker_id=? AND b.blocked_id=u.id))
      ORDER BY g.updated_at DESC LIMIT 30`,
    args:[me.uid,me.uid,me.uid,me.uid,me.uid],
  });
  const status: Record<string,string>={invited:'待应邀',playing:'对弈中',scoring:'核对终局',finished:'已终局',cancelled:'已取消'};
  return <div className="mx-auto max-w-2xl space-y-7">
    <h1 className="text-3xl"><UiText text="围棋"/></h1>
    <p><UiText text="邀请有过通信的笔友下一局九路围棋。"/></p>
    <GoInvite/>
    <ul className="space-y-3">{rows.map(row=><li key={String(row.id)}>
      <Link className="underline underline-offset-4" href={'/go/'+row.id}>{String(row.peer)} · <UiText text={status[String(row.state)]}/></Link>
    </li>)}</ul>
  </div>;
}
