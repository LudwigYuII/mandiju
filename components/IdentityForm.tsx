"use client";
import {useActionState} from 'react';
import {setIdentityAction,setRetreatAction,setSealStyleAction} from '@/lib/identity-actions';
import {UiText,UiInput} from './UiText';
import Seal from './Seal';
export default function IdentityForm({name='',until='',style='yang',showReferrer=false,initial=false}:{name?:string;until?:string;style?:string;showReferrer?:boolean;initial?:boolean}) {
 const [n,nAction,nPending]=useActionState(setIdentityAction,{});
 const [t,tAction,tPending]=useActionState(setRetreatAction,{});
 const [s,sAction,sPending]=useActionState(setSealStyleAction,{});
 const message=(state:{error?:string;ok?:boolean})=><p role="status" className="text-sm text-ink-soft"><UiText text={state.error || (state.ok?'已保存':'')} /></p>;
 if(initial) return <form action={nAction} className="space-y-5"><label className="block"><UiText text="雅号"/><UiInput name="name" required className="input mt-2" placeholder="二至四个汉字" autoComplete="off" /></label><p className="text-sm text-ink-soft"><UiText text="雅号公开展示；原账号和登录邮箱保留。简繁及兼容字归一后不可重名，题定后暂不开放改名。"/></p><label><UiText text="印章"/> <select name="style" className="input"><option value="yang"><UiText text="阳刻"/></option><option value="yin"><UiText text="阴刻"/></option></select></label>{message(n)}<button disabled={nPending} className="btn"><UiText text={nPending?'正在题定…':'题定雅号'}/></button></form>;
 return <div className="space-y-8"><form action={sAction} className="space-y-4"><div className="flex gap-4 items-center"><Seal char={name||'印'} size={56}/><h2><UiText text="雅号与私印"/> · {name||'尚未题定'}</h2></div><label className="block"><UiText text="印章"/> <select name="style" defaultValue={style} className="input"><option value="yang"><UiText text="阳刻"/></option><option value="yin"><UiText text="阴刻"/></option></select></label><label className="flex gap-2"><UiInput type="checkbox" name="referrer" defaultChecked={showReferrer}/><UiText text="公开引荐关系：展示我的引荐人，并允许自己作为引荐人被展示（双方均同意才显示）"/></label>{message(s)}<button disabled={sPending} className="btn-ghost"><UiText text="保存"/></button></form><form action={tAction} className="space-y-4"><h2><UiText text="闭关"/></h2><p className="text-sm leading-loose text-ink-soft"><UiText text="闭关期间仍可收信，新来信暂存，出关后按原定送达时间与出关时间中较晚者开放。可延长或提前出关；已送达的信件、旧信和时光胶囊不受影响。"/></p><label className="block"><UiText text="出关日期（网站公共时区当日零时）"/><UiInput type="date" name="until" defaultValue={until} className="input mt-2"/></label><p className="text-xs text-ink-soft"><UiText text="清空日期并保存，即提前出关。"/></p>{message(t)}<button disabled={tPending} className="btn-ghost"><UiText text="保存闭关设置"/></button></form></div>;
}
