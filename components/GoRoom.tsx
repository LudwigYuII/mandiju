'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { goAction } from '@/app/go/actions';
import { UiText } from './UiText';

export function GoInvite() {
  const [state, action, pending] = useActionState(goAction,{});
  return <form action={action} className="space-y-3">
    <input type="hidden" name="op" value="invite"/>
    <label className="block"><UiText text="笔友雅号"/> <input className="input" name="peer" required maxLength={40}/></label>
    <button className="btn" disabled={pending}><UiText text="邀一局围棋"/></button>
    {state.error&&<p role="alert"><UiText text={state.error}/></p>}
  </form>;
}

const labels: Record<string,string> = {
  accept:'接受邀请', cancel:'取消邀请', pass:'停一手', resign:'认输',
  resume:'继续对局', score:'确认数子',
};
export default function GoRoom({id,board,status,turn,revision,color,dead,acceptedBy}: {
  id:string; board:string; status:string; turn:number; revision:number; color:number; dead:number[]; acceptedBy:number;
}) {
  const router=useRouter();
  const [state,action,pending]=useActionState(goAction,{});
  const live=['invited','playing','scoring'].includes(status);
  useEffect(()=>{
    if (!live || pending) return;
    const timer=window.setInterval(()=>{
      if (document.visibilityState==='visible') router.refresh();
    },2000);
    return ()=>window.clearInterval(timer);
  },[router,live,pending]);
  const scoring=status==='scoring';
  const canMove=status==='playing'&&color===turn;
  const operations=status==='invited'?(color===2?['accept','cancel']:['cancel']):scoring
    ?[...(acceptedBy===color?[]:['score']),'resume','resign']:status==='playing'?[...(canMove?['pass']:[]),'resign']:[];
  return <form action={action} className="space-y-5">
    <input name="id" value={id} type="hidden"/>
    <input name="revision" value={revision} type="hidden"/>
    <p aria-live="polite"><UiText text={scoring?(acceptedBy?'一方已确认，等待另一方':'双方核对并标记死子'):status==='playing'?(turn===1?'黑方落子':'白方落子'):status==='invited'?'等待应邀':''}/></p>
    <div className="grid w-full max-w-md grid-cols-9 border border-stone-700 bg-[#ecd6aa]" aria-label="九路围棋棋盘">
      {Array.from(board).map((stone,index)=>{
        const named=stone==='1'?'黑子':stone==='2'?'白子':'空';
        return <button key={index} type="submit" name="command" value={(scoring?'mark:':'move:')+index}
          aria-label={`${Math.floor(index/9)+1}行${index%9+1}列，${named}${dead.includes(index)?'，标记为死子':''}`}
          disabled={pending||!(scoring?stone!=='0':canMove&&stone==='0')}
          className="relative flex aspect-square items-center justify-center border border-stone-600/50 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-red-900">
          {stone!=='0'&&<span aria-hidden="true" className={`h-3/4 w-3/4 rounded-full border border-stone-700 ${stone==='1'?'bg-stone-900':'bg-white'} ${dead.includes(index)?'opacity-35':''}`}/>}
        </button>;
      })}
    </div>
    <div className="flex flex-wrap gap-3">{operations.map(op=><button key={op} className="btn-ghost" name="op" value={op} disabled={pending}><UiText text={labels[op]}/></button>)}</div>
    {state.error&&<p role="alert"><UiText text={state.error}/></p>}
  </form>;
}
