import { getChatGPTUser, chatGPTSignInPath } from './chatgpt-auth';
import ClubApp from './club-app';
export const dynamic = 'force-dynamic';
export default async function Page(){ const user=await getChatGPTUser(); return user ? <ClubApp/> : <main className="welcome"><div className="brand">羽球局<span>PRIVATE BADMINTON CLUB</span></div><div className="welcome-card"><p className="eyebrow">约一场好球</p><h1>球场见。<br/>其余的，交给羽球局。</h1><p>报名与候补 · 公平排场 · 比赛积分 · 透明 AA</p><a className="primary" href={chatGPTSignInPath('/')} target="_top">使用 ChatGPT 登录</a><small>私人群组，登录并加入后才能查看活动和名单。</small></div></main> }
