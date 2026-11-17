"use client";
import { useEffect,useState } from 'react';
import WorldTravelMap from './WorldTravelMap';
import { UiText,UiInput } from './UiText';
import type {Place} from '@/lib/geography';
export type InitialTravelLocation={place_id?:string;place_name?:string;longitude?:number;latitude?:number;canonical_name?:string;country_label?:string;region?:string};
export default function TravelLocation({initial={}}:{initial?:InitialTravelLocation}){
 const [mode,setMode]=useState(initial.place_id?'catalog':'manual'),[chosen,setChosen]=useState<Place|null>(initial.place_id?{id:initial.place_id,name:initial.canonical_name||'',country:initial.country_label||'',english:'',region:initial.region||'',longitude:initial.longitude||0,latitude:initial.latitude||0}:null);
 const [point,setPoint]=useState<{longitude:number;latitude:number}|null>(initial.longitude!==undefined&&initial.latitude!==undefined?{longitude:initial.longitude,latitude:initial.latitude}:null),[query,setQuery]=useState(''),[results,setResults]=useState<Place[]>([]),[error,setError]=useState('');
 const [manualLon,setManualLon]=useState(String(initial.longitude??'')),[manualLat,setManualLat]=useState(String(initial.latitude??''));
 useEffect(()=>{const controller=new AbortController();if(Array.from(query.trim()).length<2){setResults([]);return;}
  const timer=setTimeout(()=>{setError('');fetch('/api/travel/places?q='+encodeURIComponent(query),{signal:controller.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(v=>setResults(v.places||[])).catch(e=>{if(e.name!=='AbortError'){setResults([]);setError('地点搜索暂不可用，可改用地图选点');}});},300);
  return()=>{controller.abort();clearTimeout(timer);};},[query]);
 function pick(lon:number,lat:number){setMode('manual');setChosen(null);setPoint({longitude:lon,latitude:lat});setManualLon(String(lon));setManualLat(String(lat));}
 return <fieldset className="space-y-4"><legend className="mb-3 text-lg"><UiText text="选择游记地点"/></legend>
   <input type="hidden" name="location_kind" value={mode}/><input type="hidden" name="place_id" value={mode==='catalog'?chosen?.id||'':''}/>
   <label className="block space-y-2"><span><UiText text="搜索城市（至少两个字，可用中文或外文）"/></span><UiInput value={query} onChange={e=>setQuery(e.target.value)} maxLength={80} className="input w-full" autoComplete="off"/></label>
   <p className="text-xs leading-loose text-ink-soft"><UiText text="资料库覆盖全球部分城市；没有找到时，可在地图上选点并自题地名。搜索不会发送到第三方地图服务。"/></p>
   {query.trim().length>=2&&<ul className="max-h-56 space-y-2 overflow-y-auto" aria-label="地点搜索结果">{results.map(p=><li key={p.id}><button type="button" className="btn-ghost w-full text-left" onClick={()=>{setChosen(p);setMode('catalog');setPoint({longitude:p.longitude,latitude:p.latitude});setResults([]);setQuery('');}}>{p.name} · {p.english} · {p.country}</button></li>)}</ul>}
   {error&&<p role="status" className="text-sm text-ink-soft"><UiText text={error}/></p>}
   {mode==='catalog'&&chosen&&<p className="text-sm"><UiText text="已选资料库地点："/>{chosen.name} · {chosen.country}</p>}
   <WorldTravelMap selected={point} onPick={pick}/>
   <button type="button" className="btn-ghost text-sm" disabled={mode==='manual'} onClick={()=>{setMode('manual');setChosen(null);if(point){setManualLon(String(point.longitude));setManualLat(String(point.latitude));}}}><UiText text="改用手动选点（地名由作者自题）"/></button>
   <div className="grid gap-4 sm:grid-cols-2"><label className="block space-y-2"><span><UiText text="经度（−180 至 180）"/></span><UiInput name="longitude" type="number" step="0.01" min={-180} max={180} className="input w-full" readOnly={mode==='catalog'} value={mode==='catalog'?chosen?.longitude??'':manualLon} onChange={e=>{setManualLon(e.target.value);}}/></label><label className="block space-y-2"><span><UiText text="纬度（−90 至 90）"/></span><UiInput name="latitude" type="number" step="0.01" min={-90} max={90} className="input w-full" readOnly={mode==='catalog'} value={mode==='catalog'?chosen?.latitude??'':manualLat} onChange={e=>setManualLat(e.target.value)}/></label></div>
   {mode==='manual'&&<button type="button" className="btn-ghost text-sm" onClick={()=>{const x=Number(manualLon),y=Number(manualLat);if(manualLon.trim()&&manualLat.trim()&&Number.isFinite(x)&&Number.isFinite(y)&&x>=-180&&x<=180&&y>=-90&&y<=90)pick(Math.round(x*100)/100,Math.round(y*100)/100);}}><UiText text="在图上查看输入坐标"/></button>}
   <label className="block space-y-2"><span><UiText text="自题地名或历史地名（选填，手动选点时必填）"/></span><UiInput name="place_name" defaultValue={initial.place_name||''} maxLength={100} className="input w-full"/></label>
   <p className="text-xs leading-loose text-ink-soft"><UiText text="坐标只保留两位小数，约为公里级；不获取设备定位。选点不证明实际到访，手动地名未经资料库核对。请勿填写住址或他人的私人位置。"/></p>
 </fieldset>;
}
