'use client';
import {useRef,useState} from 'react';
import {Trash2} from 'lucide-react';
import {toast} from 'sonner';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';

export default function PhotoDeleteButton({photo,ctx,label='删除照片'}:{photo:any;ctx:any;label?:string}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const requestId=useRef<string|null>(null),sending=useRef(false);
 if(!photo?.canDelete)return null;
 async function remove(){
  if(sending.current)return;sending.current=true;setBusy(true);setError('');
  try{
   requestId.current??=crypto.randomUUID();
   const response=await fetch('/api/photos/'+encodeURIComponent(photo.id),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',requestId:requestId.current,revision:ctx.data.revision})});
   const result=await response.json().catch(()=>null) as {error?:string}|null;
   if(!response.ok){if([404,409].includes(response.status))await ctx.refresh();throw new Error(result?.error||'删除未完成，请重试。')}
   setOpen(false);requestId.current=null;toast.success(photo.kind==='avatar'?'头像已删除':'照片已删除');
   try{await ctx.refresh()}catch{toast.info('照片已删除，请刷新页面查看。')}
  }catch(err){setError(err instanceof Error?err.message:'删除未完成，请重试。')}
  finally{sending.current=false;setBusy(false)}
 }
 const title=photo.kind==='avatar'?'删除头像':photo.kind==='racket'?'删除战拍照片':'删除照片';
 return <>
  <button type="button" className="ghost danger" style={{minHeight:44}} aria-label={title+(photo.caption?'：'+photo.caption:'')} disabled={ctx.busy||busy} onClick={()=>{setError('');setOpen(true)}}><Trash2 size={16} aria-hidden="true"/>{label}</button>
  <AlertDialog open={open} onOpenChange={next=>{if(!busy)setOpen(next)}}>
   <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{photo.kind==='avatar'?'删除后只显示名字。':photo.kind==='racket'?'这张照片将从战拍相册中移除。':'这张照片会从关联的活动、比赛及球友相册中一起移除。'}删除后无法恢复。</AlertDialogDescription></AlertDialogHeader>
    {error&&<p className="error" role="alert">{error}</p>}
    <AlertDialogFooter><AlertDialogCancel disabled={busy}>保留照片</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={event=>{event.preventDefault();void remove()}}>{busy?'正在删除…':error?'重试删除':'确认删除'}</AlertDialogAction></AlertDialogFooter>
   </AlertDialogContent>
  </AlertDialog>
 </>;
}
