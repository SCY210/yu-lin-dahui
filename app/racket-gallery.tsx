'use client';

import {useEffect, useId, useRef, useState, type FormEvent} from 'react';
import {Camera, ImagePlus, Upload} from 'lucide-react';
import {toast} from 'sonner';
import FeatureGuide from './feature-guide';
import PhotoDeleteButton from './photo-delete-button';
import ImageRightsConfirmation from './image-rights-confirmation';
import type {GalleryContext,GalleryPhoto} from './photo-gallery';

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxBytes = 5 * 1024 * 1024;

function RacketPhoto({photo, playerName,ctx}:{photo:GalleryPhoto;playerName:string;ctx:GalleryContext}) {
  const [failed, setFailed] = useState(false);
  const caption = photo.caption?.trim();
  return <figure className="racket-photo">
    <a className="racket-photo-link" href={'/api/photos/'+photo.id} target="_blank" rel="noreferrer" aria-label={`查看${playerName}的战拍照片${caption ? '：'+caption : ''}（新窗口）`}>
      {failed ? <span className="racket-image-error"><Camera size={24} aria-hidden="true"/>照片暂时无法加载<span>点此查看原图</span></span> : <img src={'/api/photos/'+photo.id} alt={caption || playerName+'的战拍照片'} loading="lazy" onError={()=>setFailed(true)}/>}
    </a>
    <figcaption>{caption || '战拍照片'}<PhotoDeleteButton photo={photo} ctx={ctx}/></figcaption>
  </figure>;
}

function RacketUpload({ctx, playerId, playerName, isOwn}:{ctx:GalleryContext;playerId:string;playerName:string;isOwn:boolean}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const requestId = useRef<string|null>(null);
  const sending = useRef(false);
  const [file, setFile] = useState<File|null>(null);
  const [preview, setPreview] = useState('');
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const previewURL = useRef('');

  useEffect(()=>()=>{if(previewURL.current)URL.revokeObjectURL(previewURL.current)},[]);

  function selectFile(next:File|null){
    if(previewURL.current)URL.revokeObjectURL(previewURL.current);
    previewURL.current=next?URL.createObjectURL(next):'';
    setPreview(previewURL.current);
    setFile(next);
  }

  function chooseFile(next:File|null) {
    setRightsConfirmed(false);
    requestId.current = null;
    setError('');
    setSuccess('');
    if (next && (!allowedTypes.has(next.type) || next.size > maxBytes || next.size === 0)) {
      selectFile(null);
      if (input.current) input.current.value = '';
      setError(next.size > maxBytes ? '照片超过5兆字节，请选择较小的照片。' : '请选择有效的照片文件，支持常见照片、透明图和网页图片格式。');
      return;
    }
    selectFile(next);
  }

  async function upload(e:FormEvent) {
    e.preventDefault();
    if (!file || !rightsConfirmed || sending.current) return;
    sending.current = true;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      requestId.current ??= crypto.randomUUID();
      const form = new FormData();
      form.set('file', file);
      form.set('kind', 'racket');
      form.set('rightsConfirmed', 'true');
      form.set('playerId', playerId);
      form.set('caption', caption.trim());
      form.set('revision', String(ctx.data.revision));
      form.set('requestId', requestId.current);
      const response = await fetch('/api/photos', {method:'POST', body:form});
      const result = await response.json().catch(()=>null) as {error?:string}|null;
      if (response.status === 409) {
        try {await ctx.refresh();} catch {throw new Error(result?.error || '数据已更新，请刷新后重新上传。');}
        throw new Error('资料已更新，请点击重试上传。');
      }
      if (!response.ok) throw new Error(result?.error || '上传未完成，请重试。');
      selectFile(null);
      setRightsConfirmed(false);
      setCaption('');
      requestId.current = null;
      if (input.current) input.current.value = '';
      setSuccess('战拍照片已上传。');
      toast.success('战拍照片已上传');
      try {await ctx.refresh();} catch {setSuccess('战拍照片已上传，请刷新页面查看。');}
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传未完成，请检查网络后重试。');
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return <details className="racket-upload-details">
    <summary><ImagePlus size={17} aria-hidden="true"/>上传战拍照片</summary>
    <form className="racket-upload-form" onSubmit={upload} aria-busy={busy}>
      <label htmlFor={id+'-file'}>选择照片<input ref={input} id={id+'-file'} aria-label={'选择'+playerName+'的战拍照片'} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} aria-describedby={id+'-help'} onChange={e=>chooseFile(e.target.files?.[0] ?? null)}/></label>
      <p className="racket-upload-help" id={id+'-help'}>支持常见照片、透明图和网页图片格式，最多5兆字节。{isOwn ? '上传你的实际战拍照片。' : '上传'+playerName+'的实际战拍照片。'}</p>
      {preview && <figure className="racket-preview"><img src={preview} alt={playerName+'选中的战拍照片预览'}/><figcaption>{file?.name}</figcaption></figure>}
      <label htmlFor={id+'-caption'}>照片说明（可选，最多300字）<input id={id+'-caption'} aria-label={playerName+'的战拍照片说明'} value={caption} maxLength={300} disabled={busy} onChange={e=>{setCaption(e.target.value);requestId.current=null;setError('');setSuccess('')}}/></label>
      {error && <p className="racket-upload-error" role="alert">{error}</p>}
      {success && <p className="racket-upload-success" role="status">{success}</p>}
      <ImageRightsConfirmation checked={rightsConfirmed} onChange={setRightsConfirmed} disabled={busy}/>
      <button className="racket-upload-button" type="submit" disabled={!file || !rightsConfirmed || busy}><Upload size={16} aria-hidden="true"/>{busy ? '正在上传…' : error ? '重试上传' : '上传照片'}</button>
    </form>
  </details>;
}

export default function RacketGallery({ctx, playerId}:{ctx:GalleryContext;playerId:string}) {
  const player = ctx.data.players.find(p=>p.id === playerId);
  const isOwn = playerId === ctx.data.me.playerId;
  const canUpload = !!player && (isOwn || (ctx.admin && (!player.protectedOwner || ctx.data.me.isOwner)));
  const photos = ctx.data.photos.filter(photo=>photo.kind === 'racket' && photo.playerIds.includes(playerId)).slice().sort((a,b)=>b.created-a.created);
  const playerName = player?.name || '球友';
  return <section className="racket-gallery" aria-label={playerName+'的战拍照片'}>
    <div className="racket-heading"><h4><Camera size={17} aria-hidden="true"/>{isOwn ? '我的战拍照片' : '这位球友的战拍照片'}</h4><FeatureGuide topic="photos" rules={ctx.data.settings.rules} label="上传说明"/>{photos.length > 0 && <span>{photos.length}张 · 最新上传在前</span>}</div>
    {photos.length ? <div className="racket-grid">{photos.map(photo=><RacketPhoto key={photo.id} photo={photo} playerName={playerName} ctx={ctx}/>)}</div> : <div className="racket-empty"><Camera size={25} aria-hidden="true"/><p>尚未上传战拍照片</p></div>}
    {canUpload && <RacketUpload key={playerId} ctx={ctx} playerId={playerId} playerName={playerName} isOwn={isOwn}/>}
  </section>;
}
