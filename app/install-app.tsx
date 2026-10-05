'use client';
import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import {Download} from 'lucide-react';

interface InstallPrompt extends Event {
 prompt:()=>Promise<void>;
 userChoice:Promise<{outcome:'accepted'|'dismissed'}>;
}
const InstallGuide=lazy(()=>import('./install-app-guide'));

export default function InstallApp(){
 const [standalone,setStandalone]=useState(false),[installed,setInstalled]=useState(false),[open,setOpen]=useState(false),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const prompt=useRef<InstallPrompt|null>(null),trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  const mode=window.matchMedia('(display-mode: standalone)');
  const detect=()=>{const value=mode.matches||!!(navigator as Navigator&{standalone?:boolean}).standalone;setStandalone(value);if(value)setInstalled(true)};
  detect();mode.addEventListener('change',detect);
  const offered=(event:Event)=>{event.preventDefault();prompt.current=event as InstallPrompt;setReady(true)};
  const done=()=>{prompt.current=null;setReady(false);setInstalled(true);setOpen(false)};
  window.addEventListener('beforeinstallprompt',offered);window.addEventListener('appinstalled',done);
  return()=>{mode.removeEventListener('change',detect);window.removeEventListener('beforeinstallprompt',offered);window.removeEventListener('appinstalled',done)};
 },[]);
 const changeOpen=(value:boolean)=>{setOpen(value);if(!value)requestAnimationFrame(()=>trigger.current?.focus())};
 async function install(){
  const offer=prompt.current;if(!offer||busy)return;
  prompt.current=null;setReady(false);setBusy(true);setError('');
  try{await offer.prompt();const choice=await offer.userChoice;if(choice.outcome==='accepted')changeOpen(false)}
  catch{setError('暂时无法打开安装提示，请使用浏览器菜单添加到主屏幕。')}
  finally{setBusy(false)}
 }
 if(installed)return <p className="hint app-installed" role="status">{standalone?'已在 App 模式中打开':'已安装，可从桌面图标打开'}</p>;
 return <div className="app-install">
  <button ref={trigger} type="button" className="secondary" aria-haspopup="dialog" aria-expanded={open} onClick={()=>changeOpen(true)}><Download size={17} aria-hidden="true"/>安装到手机</button>
  {open&&<Suspense fallback={<p className="hint" role="status">正在加载安装说明…</p>}><InstallGuide open={open} onOpenChange={changeOpen} ready={ready} busy={busy} error={error} install={install}/></Suspense>}
 </div>;
}
