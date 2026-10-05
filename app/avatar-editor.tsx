'use client';
import {useState} from 'react';
import {Camera} from 'lucide-react';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import PhotoGallery from './photo-gallery';

export default function AvatarEditor({ctx,playerId=ctx.data.me.playerId,className='ghost'}:any){
 const [open,setOpen]=useState(false),player=ctx.data.players.find((p:any)=>p.id===playerId);
 const canEdit=!!player&&(playerId===ctx.data.me.playerId||(ctx.data.me.role==='admin'&&(!player.protectedOwner||ctx.data.me.isOwner)));
 if(!canEdit)return null;
 return <>
  <button type="button" className={className} onClick={()=>setOpen(true)}><Camera size={17} aria-hidden="true"/>更换头像</button>
  <Dialog open={open} onOpenChange={setOpen}>
   <DialogContent className="app-dialog"><DialogHeader><DialogTitle>更换头像</DialogTitle><DialogDescription>{player.name} · 支持 JPG、PNG、WebP，图片不超过5MB。</DialogDescription></DialogHeader>
    <PhotoGallery key={playerId} ctx={ctx} playerId={playerId} avatar/>
   </DialogContent>
  </Dialog>
 </>;
}
