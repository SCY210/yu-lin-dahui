'use client';
import {useState,type FormEvent} from 'react';
import {Plus,X} from 'lucide-react';
import './blocked-words-manager.css';

export default function BlockedWordsManager({ctx}:any){
 const [draft,setDraft]=useState(''),[error,setError]=useState(''),[saving,setSaving]=useState(false);
 const words:string[]=ctx.data.settings.blockedWords??[];
 if(ctx.data.me.role!=='admin')return null;
 async function save(next:string[],clear=false){if(saving||ctx.busy)return;setSaving(true);setError('');try{await ctx.action('blockedWords',{words:next},false);if(clear)setDraft('')}catch(e){setError((e as Error).message)}finally{setSaving(false)}}
 function add(e:FormEvent){e.preventDefault();const word=draft.trim().normalize('NFC');if(!word)return;if([...word].length>50){setError('每个屏蔽词最多50个字');return}if(words.some(existing=>existing.toLowerCase()===word.toLowerCase())){setError('这个屏蔽词已存在');return}if(words.length>=200){setError('词库已达到200个，请先删除不需要的词');return}void save([...words,word],true)}
 return <section className="card blocked-words-manager" aria-label="屏蔽词管理">
  <div className="row"><h3>屏蔽词管理</h3><span className="muted">{words.length} / 200</span></div>
  <p className="hint">管理员和群主均可添加或删除。昵称、口号、打法、装备说明、活动标题与备注、报名备注、球馆/场地名称和照片说明命中后，每个字显示为 *。英文不区分大小写，修改词库后刷新生效。</p>
  <form className="blocked-word-form" onSubmit={add}><label>添加屏蔽词<input value={draft} onChange={e=>setDraft(e.target.value)} maxLength={100} placeholder="输入要屏蔽的词" disabled={saving||ctx.busy} autoComplete="off"/></label><button className="primary" disabled={!draft.trim()||saving||ctx.busy}><Plus size={16}/>{saving?'正在保存…':'添加'}</button></form>
  {error&&<p className="error" role="alert">{error}</p>}
  {words.length?<ul className="blocked-word-list">{words.map(word=><li key={word}><span>{word}</span><button type="button" className="ghost" disabled={saving||ctx.busy} aria-label={'删除屏蔽词“'+word+'”'} title="删除此屏蔽词" onClick={()=>void save(words.filter(existing=>existing!==word))}><X size={15}/></button></li>)}</ul>:<p className="muted blocked-words-empty">还没有屏蔽词。添加后，已有内容和以后提交的内容都会按词库显示。</p>}
 </section>;
}
