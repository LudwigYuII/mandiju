import LiteraryForm from './LiteraryForm';
import TravelLocation,{InitialTravelLocation} from './TravelLocation';
import { UiText,UiInput,UiTextarea } from './UiText';
export default function TravelEditor({uid,entry}:{uid:string;entry?:(InitialTravelLocation&{id:string;title:string;body:string;revision:number;visibility:string})}){
 return <LiteraryForm travel op="save" fields={{id:entry?.id||'',revision:String(entry?.revision||0),send_key:crypto.randomUUID()}} label="保存游记" draftKey={`${uid}:travel:${entry?.id||'new'}`}>
   <label className="block space-y-2"><span><UiText text="篇名（最多八十字）"/></span><UiInput name="title" required maxLength={80} defaultValue={entry?.title||''} className="input w-full"/></label>
   <TravelLocation initial={entry}/>
   <label className="block space-y-2"><span><UiText text="正文（最多一万字）"/></span><UiTextarea name="body" required rows={12} defaultValue={entry?.body||''} className="input w-full"/></label>
   <p className="text-sm text-ink-soft"><UiText text="自注写法：[[词语|解释或出处]]。原文保存，点击或键盘聚焦词语即可展读注释。"/></p>
   <fieldset className="space-y-3"><legend className="mb-2"><UiText text="游记可见范围"/></legend><label className="flex gap-3"><UiInput name="visibility" type="radio" value="private" defaultChecked={!entry||entry.visibility==='private'}/><UiText text="仅本人可见"/></label><label className="flex gap-3"><UiInput name="visibility" type="radio" value="public" defaultChecked={entry?.visibility==='public'}/><UiText text="公开正文、雅号与地点，并在云游地图留下墨点"/></label></fieldset>
   <label className="flex items-start gap-3"><UiInput name="consent" type="checkbox"/><UiText text="如选择公开，我确认有权展示本文，并同意公开正文、雅号、自题地名及地图坐标；可随时收回，不授权转载或出版"/></label>
   <p className="text-xs leading-loose text-ink-soft"><UiText text="公开游记可能被他人保存；收回可停止站内展示，不能撤销已被他人复制的内容。被反馈的游记会向站长保留该次反馈的文字证据。"/></p>
 </LiteraryForm>;
}
