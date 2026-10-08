'use client';
import {useId,useState} from 'react';
import {X} from 'lucide-react';
import {Dialog,DialogClose,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {getFeatureGuide,guideLabels,guideTopics,type GuideTopic} from '@/lib/feature-guides';
import type {Rules} from '@/lib/domain/types';
import {cultivationRealms} from '@/lib/domain/cultivation';
import RealmBadge from './realm-badge';

// Realm rows show the animated badge; clipping keeps its mist from adding a scrollbar.
const realmNames=new Set<string>(cultivationRealms.map(realm=>realm.name));
export default function FeatureGuideContent({topic,rules,onOpenChange}:{topic:GuideTopic;rules?:Rules;onOpenChange:(open:boolean)=>void}){
  const [selected, setSelected] = useState<GuideTopic>(topic);
  const selectId = useId();
  const guide = getFeatureGuide(selected, rules);
  function navigate(next:GuideTopic) {
    setSelected(next);
    document.getElementById(selectId+'-body')?.scrollTo({top:0});
  }
  return (<Dialog open onOpenChange={onOpenChange}>
    <DialogContent showCloseButton={false} className="feature-guide-panel flex max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-[640px] flex-col gap-4 overflow-hidden rounded-[20px] border-[var(--border)] bg-white p-5 text-[var(--foreground)] sm:max-w-[640px] sm:p-6">
      <DialogHeader className="shrink-0 pr-9 text-left">
        <p className="m-0 text-sm font-semibold text-[var(--primary)]">羽林大会 · 功能说明</p>
        <DialogTitle className="text-xl leading-snug">{guide.title}</DialogTitle>
        <DialogDescription className="text-base leading-relaxed text-[var(--muted-foreground)]">{guide.description}</DialogDescription>
      </DialogHeader>
      <DialogClose asChild>
        <button type="button" aria-label="关闭功能说明" className="absolute right-3 top-3 flex size-11 items-center justify-center rounded-xl border-0 bg-transparent text-[var(--muted-foreground)] hover:bg-[var(--muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"><X className="size-5" aria-hidden="true"/></button>
      </DialogClose>
      <div className="shrink-0">
        <label htmlFor={selectId} className="mb-2 block text-sm font-medium text-[var(--muted-foreground)]">查看其他功能</label>
        <select id={selectId} value={selected} onChange={e=>navigate(e.target.value as GuideTopic)} className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-base text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]">
          {guideTopics.filter(item=>item!=='annual').map(item=><option key={item} value={item}>{guideLabels[item]}</option>)}
        </select>
      </div>
      <div id={selectId+'-body'} role="region" aria-label={guide.title+'详细说明'} tabIndex={0} className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain pr-1 text-base leading-7 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]">
        {guide.table&&<section>
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="w-full border-collapse text-left text-base">
              <caption className="bg-[var(--background)] px-3 py-2 text-left font-semibold">{guide.table.caption}</caption>
              <thead><tr>{guide.table.columns.map(column=><th scope="col" key={column} className="border-t border-[var(--border)] bg-[var(--accent)] px-3 py-2 font-medium">{column}</th>)}</tr></thead>
              <tbody>{guide.table.rows.map(row=><tr key={row[0]}>{row.map((cell,i)=>i===0?<th key={i} scope="row" className={'border-t border-[var(--border)] px-3 py-2 font-medium'+(realmNames.has(cell)?' overflow-clip':'')}>{realmNames.has(cell)?<RealmBadge realm={cell}/>:cell}</th>:<td key={i} className="border-t border-[var(--border)] px-3 py-2">{cell}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </section>}
        {guide.sections.map(section=><section key={section.title}>
          <h3 className="mb-2 mt-0 text-base font-semibold text-[var(--foreground)]">{section.title}</h3>
          {section.paragraphs?.map(paragraph=><p key={paragraph} className="mb-3 mt-0">{paragraph}</p>)}
          {section.items&&<ul className="m-0 list-disc space-y-2 pl-5">{section.items.map(item=><li key={item}>{item}</li>)}</ul>}
        </section>)}
        {guide.example&&<section className="rounded-xl border border-[var(--border)] bg-[var(--accent)] p-4">
          <h3 className="mb-2 mt-0 text-base font-semibold text-[var(--accent-foreground)]">{guide.example.title}</h3><p className="m-0">{guide.example.text}</p>
        </section>}
        <section>
          <h3 className="mb-2 mt-0 text-base font-semibold">相关说明</h3>
          <div className="flex flex-wrap gap-2">{guide.related.filter(item=>item!=='annual').map(item=><button type="button" key={item} onClick={()=>navigate(item)} className="min-h-11 rounded-full border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--primary)] hover:bg-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]">{guideLabels[item]}</button>)}</div>
        </section>
      </div>
      <DialogClose asChild><button type="button" className="feature-guide-done min-h-11 shrink-0 rounded-xl border-0 bg-[var(--primary)] px-4 py-2 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]">我知道了</button></DialogClose>
    </DialogContent>
  </Dialog>);
}
