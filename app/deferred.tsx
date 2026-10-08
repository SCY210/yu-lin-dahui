'use client';
import {Component,Suspense,type ReactNode} from 'react';
import {isChunkLoadError,reloadOnceForNewVersion,sessionStore} from '../lib/client/wake-recovery';

/** A screen that cannot load (usually a new version deployed while the app slept)
 * reloads once into the new version, otherwise offers a refresh instead of a blank page. */
class LoadRecovery extends Component<{children:ReactNode},{failed:boolean;updated:boolean}>{
 state={failed:false,updated:false};
 static getDerivedStateFromError(error:unknown){return {failed:true,updated:isChunkLoadError(error)}}
 componentDidCatch(error:unknown){if(isChunkLoadError(error))reloadOnceForNewVersion(sessionStore(),()=>location.reload())}
 render(){
  if(!this.state.failed)return this.props.children;
  return <p className="hint load-recovery" role="alert">{this.state.updated?'网站刚刚更新，需要刷新后继续使用。':'这部分内容暂时无法加载。'}<button type="button" className="secondary" onClick={()=>location.reload()}>点击刷新</button></p>;
 }
}

export default function Deferred({children}:{children:ReactNode}){
 return <LoadRecovery><Suspense fallback={<p className="hint" role="status">正在加载…</p>}>{children}</Suspense></LoadRecovery>;
}
