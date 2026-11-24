'use server';

import { db, waitDb } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { playGo } from '@/lib/go-service';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export async function goAction(_: {error?: string}, form: FormData) {
  await waitDb();
  const session = await getSession();
  if (!session) redirect('/login');
  if (!(await rateLimit('go:'+session.uid, 60, 60000)).ok) return {error:'操作过于频繁，请稍后再试'};
  const input = Object.fromEntries([...form].filter((entry):entry is [string,string]=>typeof entry[1]==='string'));
  if (input.command) [input.op,input.point]=input.command.split(':');
  let id: string;
  try { id=await playGo(db,session.uid,input); }
  catch (error) {
    const message=error instanceof Error?error.message:'';
    return {error:/[\u4e00-\u9fff]/.test(message)?message:'操作未成功，请刷新棋盘后再试'};
  }
  revalidatePath('/go');
  revalidatePath('/go/'+id);
  if (input.op==='invite') redirect('/go/'+id);
  return {};
}
