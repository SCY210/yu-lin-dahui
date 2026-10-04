import { getAppUser } from '../lib/auth';
import AuthPanel from './auth-panel';
import ClubApp from './club-app';
export const dynamic = 'force-dynamic';
export default async function Page(){ const user=await getAppUser(); return user ? <ClubApp/> : <main className="welcome"><div className="brand">羽林大会<span>PRIVATE BADMINTON CLUB</span></div><AuthPanel/></main> }
