import Link from 'next/link';
import { notFound,redirect } from 'next/navigation';
import { db, waitDb } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { readGame } from '@/lib/go-service';
import GoRoom from '@/components/GoRoom';
import { UiText } from '@/components/UiText';

export const dynamic='force-dynamic';

export default async function GamePage({params}:{params:Promise<{id:string}>}) {
  await waitDb();
  const viewer=await getSession();
  if (!viewer) redirect('/login');
  const {id}=await params;
  const game=await readGame(db,id,viewer.uid);
  if (!game) notFound();
  const color=game.black_id===viewer.uid?1:2;
  return <main className="mx-auto max-w-2xl space-y-6">
    <Link href="/go" className="underline"><UiText text="返回棋室"/></Link>
    <h1 className="text-3xl"><UiText text="九路围棋"/></h1>
    <p><UiText text="黑方"/> {String(game.black_name)} · <UiText text="白方"/> {String(game.white_name)} · <UiText text={color===1?'你执黑':'你执白'}/></p>
    <p className="text-sm text-ink-soft"><UiText text="按面积计分，白贴七目半。双方连续停着后，可标记死子并共同确认，也可继续下。"/></p>
    {game.state==='cancelled'&&<p><UiText text="邀请已取消"/></p>}
    {game.result&&<p><UiText text={String(game.result)}/></p>}
    <GoRoom id={id} board={String(game.board)} status={String(game.state)} turn={Number(game.turn)}
      revision={Number(game.revision)} color={color} dead={game.dead?String(game.dead).split(',').map(Number):[]}
      acceptedBy={Number(game.accepted_by)}/>
  </main>;
}
