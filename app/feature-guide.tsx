'use client';
import {lazy,Suspense,useRef,useState} from 'react';
import {CircleAlert,Info} from 'lucide-react';
import {guideLabels,type GuideTopic} from '@/lib/feature-guide-topics';
import type {Rules} from '@/lib/domain/types';
const GuideContent=lazy(()=>import('./feature-guide-content'));
export type FeatureGuideProps={topic:GuideTopic;rules?:Rules;label?:string;iconOnly?:boolean};
export default function FeatureGuide({topic,rules,label='功能说明',iconOnly=false}:FeatureGuideProps){
 const [open,setOpen]=useState(false);
 const trigger=useRef<HTMLButtonElement>(null);
 const changeOpen=(value:boolean)=>{setOpen(value);if(!value)requestAnimationFrame(()=>trigger.current?.focus())};
 return <>
  <button ref={trigger} type="button" onClick={()=>changeOpen(true)} aria-haspopup="dialog" aria-expanded={open} aria-label={iconOnly?'功能说明':guideLabels[topic]+'：'+label} title={iconOnly?'功能说明':undefined} className={"inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border border-[var(--border)] bg-white text-sm font-medium text-[var(--primary)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] "+(iconOnly?'size-11 p-0':'px-3 py-1.5')}>{iconOnly?<CircleAlert aria-hidden="true" className="size-5"/>:<><Info aria-hidden="true" className="size-4 shrink-0"/><span>{label}</span></>}</button>
  {open&&<Suspense fallback={<span className="hint" role="status">正在加载说明…</span>}><GuideContent topic={topic} rules={rules} onOpenChange={changeOpen}/></Suspense>}
 </>;
}
