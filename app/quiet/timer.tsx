'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';

export default function Timer({ends}:{ends:number}) {
  const router=useRouter();
  const [seconds,setSeconds]=useState<number|null>(null);
  useEffect(()=>{
    const tick=()=>{
      const left=Math.max(0,Math.ceil((ends-Date.now())/1000));
      setSeconds(left);
      if (!left) { window.clearInterval(timer); router.refresh(); }
    };
    const timer=window.setInterval(tick,1000);
    tick();
    return ()=>window.clearInterval(timer);
  },[ends,router]);
  return <div className="py-12 text-center">
    <span aria-hidden="true" className="quiet-smoke mx-auto mb-8 block"/>
    <p role="timer" className="text-3xl tabular-nums">{seconds===null?'—':Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')}</p>
  </div>;
}
