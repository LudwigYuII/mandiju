"use client";
import { useEffect,useRef,useState } from 'react';
import { UiText } from './UiText';
export type TravelPin={id:string;title:string;longitude:number;latitude:number};
export default function WorldTravelMap({pins=[],selected,onPick}:{pins?:TravelPin[];selected?:{longitude:number;latitude:number}|null;onPick?:(longitude:number,latitude:number)=>void}){
 const [paths,setPaths]=useState<string[]>([]),[failed,setFailed]=useState(false),[view,setView]=useState({x:0,y:0,k:1});
 const svg=useRef<SVGSVGElement>(null),drag=useRef<{x:number;y:number;ox:number;oy:number;moved:boolean}|null>(null);
 useEffect(()=>{const controller=new AbortController();fetch('/geography/world-land.json',{signal:controller.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(setPaths).catch(e=>{if(e.name!=='AbortError')setFailed(true);});return()=>controller.abort();},[]);
 useEffect(()=>{if(selected)setView({k:3,x:500-(selected.longitude+180)/.36*3,y:250-(90-selected.latitude)/.36*3});},[selected?.longitude,selected?.latitude]);
 function zoom(mult:number){setView(v=>{const k=Math.max(1,Math.min(6,v.k*mult)),ratio=k/v.k;return {k,x:500-(500-v.x)*ratio,y:250-(250-v.y)*ratio};});}
 function move(dx:number,dy:number){setView(v=>({...v,x:Math.max(100-1000*v.k,Math.min(900,v.x+dx)),y:Math.max(50-500*v.k,Math.min(450,v.y+dy))}));}
 return <div className="space-y-3">
   <div className="flex flex-wrap gap-2 text-sm" aria-label="地图控制">
     <button type="button" className="btn-ghost" onClick={()=>zoom(1.5)}><UiText text="放大"/></button><button type="button" className="btn-ghost" onClick={()=>zoom(1/1.5)}><UiText text="缩小"/></button><button type="button" className="btn-ghost" onClick={()=>setView({x:0,y:0,k:1})}><UiText text="全球"/></button>
     <button type="button" className="btn-ghost" onClick={()=>move(80,0)} aria-label="地图向左">←</button><button type="button" className="btn-ghost" onClick={()=>move(-80,0)} aria-label="地图向右">→</button><button type="button" className="btn-ghost" onClick={()=>move(0,60)} aria-label="地图向上">↑</button><button type="button" className="btn-ghost" onClick={()=>move(0,-60)} aria-label="地图向下">↓</button>
   </div>
   <svg ref={svg} viewBox="0 0 1000 500" className="w-full rounded-sm border border-[var(--paper-edge)] bg-[var(--paper2)] text-ink" style={{touchAction:'none',cursor:onPick?'crosshair':'grab'}} role="group" aria-label={onPick?'全球选点地图；也可用下方经纬度输入':'全球游记地图；下方有同样内容的文字列表'} tabIndex={0}
    onKeyDown={e=>{const dirs:Record<string,[number,number]>={ArrowLeft:[80,0],ArrowRight:[-80,0],ArrowUp:[0,60],ArrowDown:[0,-60]};if(dirs[e.key]){e.preventDefault();move(...dirs[e.key]);}if(e.key==='+'||e.key==='=')zoom(1.5);if(e.key==='-')zoom(1/1.5);}}
    onPointerDown={e=>{if((e.target as Element).closest('a'))return;drag.current={x:e.clientX,y:e.clientY,ox:view.x,oy:view.y,moved:false};e.currentTarget.setPointerCapture(e.pointerId);}}
    onPointerMove={e=>{const d=drag.current,el=svg.current;if(!d||!el)return;const rect=el.getBoundingClientRect();if(Math.hypot(e.clientX-d.x,e.clientY-d.y)>5)d.moved=true;if(d.moved){const ratio=1000/rect.width;setView(v=>({...v,x:d.ox+(e.clientX-d.x)*ratio,y:d.oy+(e.clientY-d.y)*ratio}));}}}
    onPointerUp={e=>{const d=drag.current;drag.current=null;if(!d||d.moved||!onPick||!svg.current)return;const rect=svg.current.getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width*1000,y=(e.clientY-rect.top)/rect.height*500;const lon=(x-view.x)/view.k*.36-180,lat=90-(y-view.y)/view.k*.36;if(lon>=-180&&lon<=180&&lat>=-90&&lat<=90)onPick(Math.round(lon*100)/100,Math.round(lat*100)/100);}}
    onPointerCancel={()=>{drag.current=null;}}>
     <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
       {paths.map((d,i)=><path key={i} d={d} fill="var(--paper)" stroke="var(--ink-soft)" strokeWidth={.5/view.k} fillRule="evenodd"/>)}
       {[-60,0,60].map(lat=><path key={lat} d={`M0 ${(90-lat)/.36}H1000`} stroke="var(--ink-soft)" opacity=".18" strokeWidth={.5/view.k}/>)}
       {pins.map(p=><a key={p.id} href={`/travel/${p.id}`} aria-label={p.title}><circle cx={(p.longitude+180)/.36} cy={(90-p.latitude)/.36} r={4/view.k} fill="currentColor"/><title>{p.title}</title></a>)}
       {selected&&<g><circle cx={(selected.longitude+180)/.36} cy={(90-selected.latitude)/.36} r={7/view.k} fill="var(--vermilion)"/><circle cx={(selected.longitude+180)/.36} cy={(90-selected.latitude)/.36} r={12/view.k} fill="none" stroke="var(--vermilion)" strokeWidth={1/view.k}/></g>}
     </g>
   </svg>
   <p className="text-xs leading-loose text-ink-soft"><UiText text={failed?'底图暂未载入，仍可使用文字列表或经纬度选点。':'可拖动、用方向键或按钮移动地图；支持有限缩放，不提供街道导航。'}/></p>
   <p className="text-xs text-ink-soft"><UiText text="底图与地点资料："/><a href="https://www.naturalearthdata.com/about/terms-of-use/" className="underline underline-offset-4" target="_blank" rel="noopener noreferrer">Natural Earth · Public domain</a></p>
 </div>;
}
