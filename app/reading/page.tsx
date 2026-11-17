import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db,waitDb } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { ensureReadingDay,readReadingDay,readOwnReading,readReadingNotes } from '@/lib/reading-service';
import { UiText,UiInput,UiTextarea } from '@/components/UiText';
import LiteraryForm from '@/components/LiteraryForm';
export const dynamic='force-dynamic';
export default async function Reading({searchParams}:{searchParams:Promise<{day?:string;page?:string}>}){
  await waitDb();const s=await getSession(),uid=s?.uid||'',query=await searchParams;
  const today=await ensureReadingDay(db),day=query.day||today;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||day>today)notFound();
  const d=await readReadingDay(db,day);if(!d)notFound();
  const n=Number(query.page),page=Number.isSafeInteger(n)&&n>0?Math.min(n,10000):1;
  const [mine,notes,me]=await Promise.all([uid?readOwnReading(db,day,uid):null,readReadingNotes(db,day,uid,(page-1)*20),uid?db.execute({sql:'SELECT role FROM users WHERE id=?',args:[uid]}):Promise.resolve({rows:[]})]);
  const isOpen=Date.now()>=Number(d.opens_at)&&Date.now()<Number(d.closes_at),joined=!!mine&&!!Number(mine.active);
  return <div className="mx-auto max-w-3xl space-y-8">
    <header className="space-y-4"><p className="text-sm tracking-widest text-ink-soft"><UiText text="不求多，只读一页"/></p><h1 className="text-3xl"><UiText text="共读抄书"/></h1><p className="text-sm text-ink-soft">{day} · {String(d.time_zone)} · <UiText text={isOpen?'今日共读':'此日已收卷'}/></p><nav className="flex flex-wrap gap-5 text-sm"><Link href="/reading"><UiText text="今日共读"/></Link>{uid&&<Link href="/reading/mine"><UiText text="我的抄写与札记"/></Link>}<Link href="/seasons"><UiText text="节气与岁时"/></Link></nav></header>
    <article className="card space-y-6 p-6 sm:p-10"><p className="text-sm text-ink-soft">{String(d.author)} · <UiText text="节选"/></p><h2 className="text-2xl leading-relaxed">{String(d.title)}</h2><p className="whitespace-pre-wrap break-words text-lg leading-[2.1]">{String(d.body)}</p>
      <details className="border-t border-[var(--paper-edge)] pt-4 text-sm"><summary className="cursor-pointer"><UiText text="版本、来源与授权"/></summary><div className="mt-4 space-y-3 leading-loose text-ink-soft"><p>{String(d.rights_note)}</p><p><UiText text="来源："/><a href={String(d.source_url)} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4"><UiText text="维基文库固定版本与贡献者"/></a> · <a href={String(d.license_url)} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{String(d.license)}</a></p><p><UiText text="核对日期："/>{String(d.reviewed_at)}</p><p><UiText text="原文按收录版本保留；没有自动繁简转换。本站首批收录四篇古文的八段节选，依日期轮读，不设打卡与补签。"/></p></div></details>
    </article>
    {uid&&isOpen&&(!mine||joined)&&<section className="space-y-5"><h2 className="text-xl"><UiText text={joined?'接续今日笔记':'参与今日共读'}/></h2><p className="leading-loose text-ink-soft"><UiText text="抄写只给自己看，札记也默认私密。参与后可读同一天参与者主动分享的札记；无须完成抄写，也不记录连续天数。"/></p>
      <LiteraryForm reading op="save" fields={{day,revision:String(mine?.revision||0)}} label="保存并参与今日共读" draftKey={`${uid}:reading:${day}`}>
        <label className="block space-y-2"><span><UiText text="我的抄写（选填，仅本人可见）"/></span><UiTextarea name="copy_body" rows={7} className="input w-full" defaultValue={String(mine?.copy_body||'')}/></label>
        <label className="block space-y-2"><span><UiText text="我的札记（选填，最多一千字）"/></span><UiTextarea name="note" rows={5} className="input w-full" defaultValue={String(mine?.note||'')}/></label>
        <label className="flex items-start gap-3"><UiInput name="share" type="checkbox" defaultChecked={!!Number(mine?.shared)}/><UiText text="将札记与雅号分享给同一天的共读参与者（含后来于当日加入者）；不公开抄写，不授权转载或出版"/></label>
        <label className="flex items-start gap-3"><UiInput name="consent" type="checkbox" required/><UiText text="确认参与此日共读，札记按上述选择展示；可以随时撤回分享或退出。被反馈的札记会向站长保留该次反馈的文字证据"/></label>
      </LiteraryForm>
    </section>}
    {!uid&&<p><Link className="btn" href="/login"><UiText text="登录后共读"/></Link></p>}
    {mine&&<section className="space-y-4 border-t border-[var(--paper-edge)] pt-6">
      {!isOpen&&<><h2 className="text-xl"><UiText text="我的原文"/></h2><p className="whitespace-pre-wrap break-words leading-loose">{String(mine.copy_body)}</p><p className="whitespace-pre-wrap break-words leading-loose">{String(mine.note)}</p></>}
      {Number(mine.shared)>0&&<LiteraryForm reading op="unshare" fields={{id:String(mine.id)}} label="撤回札记分享"/>}
      {joined&&<details className="text-sm"><summary className="cursor-pointer"><UiText text="退出此日共读"/></summary><p className="my-3 text-ink-soft"><UiText text="退出后札记不再向同日书友展示，也不能再读他人的札记；自己的原文仍保留，不重新加入此日。"/></p><LiteraryForm reading op="leave" fields={{id:String(mine.id)}} label="确认退出此日共读"/></details>}
    </section>}
    <section className="space-y-5 border-t border-[var(--paper-edge)] pt-6"><h2 className="text-xl"><UiText text="同日书友札记"/></h2>
      {!joined?<p className="text-sm text-ink-soft"><UiText text="只有参与这一天共读的书友可读札记。已经收卷的日期不再接纳新的参与者。"/></p>:!notes.length&&<p className="text-sm text-ink-soft"><UiText text="此页尚无可读札记，静候也无妨。"/></p>}
      {notes.map(e=><article className="card space-y-4 p-6" key={String(e.id)}><p className="text-sm text-ink-soft">{String(e.pen_name)}</p><p className="whitespace-pre-wrap break-words leading-loose">{String(e.note)}</p>{String(e.user_id)!==uid&&<details className="text-sm"><summary className="cursor-pointer"><UiText text="反馈此篇札记"/></summary><div className="mt-3"><LiteraryForm reading op="report" fields={{id:String(e.id)}} label="提交反馈"><label className="block space-y-2"><span><UiText text="向站长说明问题（最多五百字）"/></span><UiTextarea name="reason" maxLength={500} required rows={3} className="input w-full"/></label></LiteraryForm></div></details>}</article>)}
      <nav className="flex flex-wrap gap-5 text-sm">{page>1&&<Link href={`?day=${day}&page=${page-1}`}><UiText text="上一页"/></Link>}{notes.length===20&&<Link href={`?day=${day}&page=${page+1}`}><UiText text="下一页"/></Link>}{me.rows[0]?.role==='admin'&&<Link href="/reading/review"><UiText text="共读治理"/></Link>}</nav>
    </section>
  </div>;
}
