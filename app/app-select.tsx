'use client';
import {Children,Fragment,isValidElement,useEffect,useId,useMemo,useRef,useState,type ChangeEvent,type KeyboardEvent,type ReactNode,type SelectHTMLAttributes} from 'react';
import {Popover} from 'radix-ui';
import {Check,ChevronDown,Search,X} from 'lucide-react';
import './app-select.css';
import {useDialogHistory} from '../lib/client/club-navigation-react';

type Option={value:string;label:string;disabled:boolean;group?:string};
type Props=Omit<SelectHTMLAttributes<HTMLSelectElement>,'multiple'|'value'|'defaultValue'>&{value?:string|number;defaultValue?:string|number;searchable?:boolean};
const text=(node:ReactNode):string=>Children.toArray(node).map(n=>isValidElement<{children?:ReactNode}>(n)?text(n.props.children):typeof n==='string'||typeof n==='number'?String(n):'').join('');
function optionsOf(children:ReactNode,disabled=false,group?:string):Option[]{
 const result:Option[]=[];Children.forEach(children,node=>{
  if(!isValidElement<{value?:string|number;children?:ReactNode;disabled?:boolean;label?:string}>(node))return;
  if(node.type==='option')result.push({value:String(node.props.value??text(node.props.children)),label:node.props.label??text(node.props.children),disabled:disabled||!!node.props.disabled,group});
  else if(node.type===Fragment||node.type==='optgroup')result.push(...optionsOf(node.props.children,disabled||!!node.props.disabled,node.type==='optgroup'?node.props.label:group));
 });return result;
}

/** A themed, searchable single-choice control. The hidden select is only the form/validation bridge;
 * it has no layout, pointer or keyboard target, and never opens a system picker. */
export default function AppSelect({children,value,defaultValue,onChange,disabled,required,className='',searchable,id,title,...nativeProps}:Props){
 const generated=useId(),triggerId=id??'app-select-'+generated,listId=triggerId+'-list',errorId=triggerId+'-error';
 const native=useRef<HTMLSelectElement>(null),trigger=useRef<HTMLButtonElement>(null),list=useRef<HTMLDivElement>(null),search=useRef<HTMLInputElement>(null),tabTarget=useRef<HTMLElement|null>(null);
 const options=useMemo(()=>optionsOf(children),[children]);
 const [localValue,setLocalValue]=useState(()=>String(defaultValue??options.find(o=>!o.disabled)?.value??'')),[open,setOpen]=useState(false),[query,setQuery]=useState(''),[active,setActive]=useState(-1),[invalid,setInvalid]=useState(false);
 const current=String(value??localValue),selected=options.find(o=>o.value===current),canSearch=searchable??options.length>=8;
 const label=nativeProps['aria-label']??title??'请选择',error=invalid&&required&&(!selected||!current);
 const shown=options.map((o,index)=>({...o,index})).filter(o=>!query.trim()||(o.label+' '+(o.group??'')).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
 const enabled=shown.filter(o=>!o.disabled),highlight=enabled.find(o=>o.index===active)??enabled[0];
 if(disabled&&open)setOpen(false);
 const changeOpen=(next:boolean)=>{if(disabled)return;if(next){setQuery('');setActive(options.findIndex(o=>o.value===current&&!o.disabled))}setOpen(next)};
 useDialogHistory(open&&!disabled,changeOpen);
 const changed=(event:ChangeEvent<HTMLSelectElement>)=>{if(value===undefined)setLocalValue(event.target.value);setInvalid(false);setOpen(false);onChange?.(event)};
 const choose=(index:number)=>{const option=options[index];if(disabled||!option||option.disabled||!native.current)return;if(native.current.value===option.value){setOpen(false);return}native.current.value=option.value;native.current.dispatchEvent(new Event('change',{bubbles:true}));};
 const move=(direction:number)=>{if(!enabled.length)return;const i=enabled.findIndex(o=>o.index===highlight?.index);setActive(enabled[(i+direction+enabled.length)%enabled.length].index)};
 const keyboard=(event:KeyboardEvent)=>{
  if(event.nativeEvent.isComposing||event.keyCode===229)return;
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();move(event.key==='ArrowDown'?1:-1)}
  else if(event.key==='Home'||event.key==='End'){if(event.target!==search.current){event.preventDefault();setActive((event.key==='Home'?enabled[0]:enabled.at(-1))?.index??-1)}}
  else if(event.key==='Enter'||event.key===' '&&event.target!==search.current){event.preventDefault();if(highlight)choose(highlight.index)}
  else if(event.key==='Tab'){
   const candidates=Array.from(document.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],[tabindex]')).filter(e=>e.tabIndex>=0&&!e.matches(':disabled')&&e.getClientRects().length>0&&!e.closest('[data-app-select-menu]'));
   const at=candidates.indexOf(trigger.current!);tabTarget.current=candidates[at+(event.shiftKey?-1:1)]??trigger.current;event.preventDefault();setOpen(false);
  }else if(event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&event.target!==search.current){
   event.preventDefault();if(canSearch){setQuery(event.key);setActive(-1);search.current?.focus()}else{const match=enabled.find(o=>o.label.toLocaleLowerCase().startsWith(event.key.toLocaleLowerCase()));if(match)setActive(match.index)}
  }
 };
 const activeIndex=highlight?.index??-1;
 useEffect(()=>{if(!open||!list.current||activeIndex<0)return;const element=list.current.querySelector<HTMLElement>(`[data-option-index="${activeIndex}"]`);element?.scrollIntoView({block:'nearest'})},[open,activeIndex,query]);
 return <Popover.Root open={open&&!disabled} onOpenChange={changeOpen}>
  <Popover.Trigger asChild><button ref={trigger} id={triggerId} type="button" role="combobox" aria-expanded={open&&!disabled} aria-haspopup="listbox" aria-controls={open?listId:undefined} aria-label={nativeProps['aria-label']} aria-labelledby={nativeProps['aria-labelledby']} aria-describedby={[nativeProps['aria-describedby'],error?errorId:undefined].filter(Boolean).join(' ')||undefined} aria-required={required} aria-invalid={error||nativeProps['aria-invalid']} title={title??selected?.label} disabled={disabled} className={'app-select-trigger '+className} style={nativeProps.style} onKeyDown={event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();changeOpen(true);if(event.key==='ArrowUp')setActive(options.findLastIndex(o=>!o.disabled))}}}>
   <span className={'app-select-value'+(!selected||!current?' is-placeholder':'')}>{selected?.label??'请选择'}</span><ChevronDown size={16} aria-hidden="true"/>
  </button></Popover.Trigger>
  <select {...nativeProps} ref={native} value={selected?current:''} disabled={disabled} required={required} onChange={changed} hidden tabIndex={-1} aria-hidden="true" style={{display:'none'}} onInvalid={event=>{event.preventDefault();setInvalid(true);changeOpen(true);trigger.current?.focus();nativeProps.onInvalid?.(event)}}>
   {!selected&&!options.some(o=>o.value==='')&&<option value="" disabled/>}{children}
  </select>
  {error&&<span className="app-select-error" id={errorId} role="alert">请选择一项后再保存</span>}
  <Popover.Portal><Popover.Content data-app-select-menu="" className="app-select-panel" align="start" sideOffset={6} collisionPadding={12} onOpenAutoFocus={event=>{event.preventDefault();list.current?.focus()}} onCloseAutoFocus={event=>{if(tabTarget.current){event.preventDefault();tabTarget.current.focus();tabTarget.current=null}}} onEscapeKeyDown={event=>{if(event.isComposing)event.preventDefault();event.stopPropagation()}} onKeyDown={keyboard}>
   <div className="app-select-heading"><span>{label}</span><small>{shown.length} 项</small></div>
   {canSearch&&<div className="app-select-search"><Search size={16} aria-hidden="true"/><input ref={search} type="search" aria-label={'搜索'+label} placeholder="输入名字或关键词" value={query} onChange={event=>{setQuery(event.target.value);setActive(-1)}} aria-controls={listId} aria-activedescendant={highlight?listId+'-'+highlight.index:undefined} autoComplete="off"/>{query&&<button type="button" aria-label="清空选项搜索" onClick={()=>{setQuery('');setActive(-1);search.current?.focus()}}><X size={14}/></button>}</div>}
   <div ref={list} id={listId} role="listbox" tabIndex={0} aria-label={label} aria-activedescendant={highlight?listId+'-'+highlight.index:undefined} className="app-select-list">
    {shown.map((option,i)=><Fragment key={option.index}>{option.group&&shown[i-1]?.group!==option.group&&<div className="app-select-group">{option.group}</div>}<button type="button" role="option" id={listId+'-'+option.index} data-option-index={option.index} aria-selected={option.value===current} aria-disabled={option.disabled} disabled={option.disabled} tabIndex={-1} className={'app-select-option'+(highlight?.index===option.index?' is-highlighted':'')} onPointerMove={event=>{if(event.pointerType==='mouse'&&!option.disabled)setActive(option.index)}} onClick={()=>choose(option.index)}><span>{option.label}</span>{option.value===current&&<Check size={16} aria-hidden="true"/>}</button></Fragment>)}
    {!shown.length&&<p className="app-select-empty" role="status">没有找到匹配项</p>}
   </div>
  </Popover.Content></Popover.Portal>
 </Popover.Root>;
}
