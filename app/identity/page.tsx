import {redirect} from 'next/navigation';
import {db,waitDb} from '@/lib/db';
import {getSession} from '@/lib/auth';
import IdentityForm from '@/components/IdentityForm';
import {UiText} from '@/components/UiText';
export const dynamic='force-dynamic';
export default async function IdentityPage(){await waitDb();const s=await getSession();if(!s)redirect('/login');const u=(await db.execute({sql:'SELECT literary_name FROM users WHERE id=?',args:[s.uid]})).rows[0];if(u?.literary_name)redirect('/');return <section className="card mx-auto max-w-lg p-8 space-y-6"><p className="text-sm text-ink-soft"><UiText text="初入书斋"/></p><h1 className="text-3xl"><UiText text="为往来题一个雅号"/></h1><IdentityForm initial/></section>}
