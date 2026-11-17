import Link from 'next/link';
import { seasonalTheme } from '@/lib/seasonal-service';
import { UiText } from './UiText';
export default function SeasonalHeader(){
  const s=seasonalTheme();
  return <aside className="seasonal-panel relative overflow-hidden rounded-sm border-l-2 py-4 pl-5 pr-16" style={{borderColor:s.color}}>
    <svg aria-hidden="true" className="pointer-events-none absolute right-1 top-2 h-16 w-14 opacity-40" viewBox="0 0 60 80" fill="none" stroke={s.color} strokeWidth="1.2"><path d="M16 72Q30 48 34 8M27 46Q9 42 10 26Q29 30 27 46M32 30Q49 24 49 11Q32 15 32 30M22 58Q42 57 48 41Q28 43 22 58"/></svg>
    <p className="text-xs tracking-widest text-ink-soft"><UiText text="岁时"/> · <UiText text={s.term}/></p>
    <p className="mt-2 leading-loose"><UiText text={s.caption}/></p>
    <Link href="/seasons" className="mt-2 inline-block text-xs underline underline-offset-4"><UiText text="翻阅岁时历"/></Link>
  </aside>;
}
