import { getAppUser } from '../lib/auth';
import AuthPanel from './auth-panel';
import ClubApp from './club-app';
import CultivationOrnament from './cultivation-ornament';
export const dynamic = 'force-dynamic';
export default async function Page(){ const user=await getAppUser(); return user ? <ClubApp/> : <main className="welcome"><div className="brand-lockup"><CultivationOrnament variant="compact"/><div className="brand">羽林大会<span>以球会友 · 一拍一境</span></div></div><AuthPanel/></main> }
