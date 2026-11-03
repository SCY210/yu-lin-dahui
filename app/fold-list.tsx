'use client';
import {useState,type ReactNode} from 'react';
import './fold-list.css';

/** The first few entries of a long list, the rest behind one button, so a home card with many activities or a
 * collector's transfer list does not push the rest of the page several screens down (docs/COMPACT_MOBILE_LAYOUT.md). */
export default function FoldList({items,shown=2,unit='场活动'}:{items:ReactNode[];shown?:number;unit?:string}){
 const [all,setAll]=useState(false);
 return <>{all?items:items.slice(0,shown)}{items.length>shown&&<button type="button" className="fold-more" aria-expanded={all} onClick={()=>setAll(!all)}>{all?'收起':'还有 '+(items.length-shown)+' '+unit+' ›'}</button>}</>;
}
