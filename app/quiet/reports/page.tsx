import Link from 'next/link';
import {notFound} from 'next/navigation';
import {db,waitDb} from '@/lib/db';
import {getSession} from '@/lib/auth';
import {UiText} from '@/components/UiText';

export default async function Reports(){
  await waitDb();
  const me=await getSession();
  if(!me) notFound();
  const {rows}=await db.execute({sql:"SELECT 1 FROM users WHERE id=? AND role='admin'",args:[me.uid]});
  if(!rows.length) notFound();
  const reports=(await db.execute({sql:'SELECT post_id,reporter,body,reason FROM quiet_reports WHERE expires>? ORDER BY expires DESC LIMIT 50',args:[Date.now()]})).rows;
  return <section className="mx-auto max-w-2xl space-y-5">
    <h1 className="text-3xl"><UiText text="夜话反馈"/></h1>
    {!reports.length&&<p><UiText text="暂无反馈。"/></p>}
    {reports.map(r=><article className="card p-6" key={String(r.post_id)+String(r.reporter)}>
      <p className="whitespace-pre-wrap break-words">{String(r.body)}</p>
      <p className="mt-3 text-sm text-ink-soft">{String(r.reason)}</p>
    </article>)}
    <Link href="/quiet?tab=night" className="underline"><UiText text="返回夜话"/></Link>
  </section>;
}
