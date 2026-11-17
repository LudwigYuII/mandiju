import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { UiText } from '@/components/UiText';
import TravelEditor from '@/components/TravelEditor';
export const dynamic='force-dynamic';
export default async function NewTravel(){const s=await getSession();if(!s)redirect('/login');return <div className="mx-auto max-w-3xl space-y-6"><h1 className="text-3xl"><UiText text="写一篇游记"/></h1><p className="leading-loose text-ink-soft"><UiText text="可以写旧日行旅，也可记一处与自己有缘的地方。默认只给自己看，公开后才会在云游地图留下墨点。"/></p><TravelEditor uid={s.uid}/></div>;}
