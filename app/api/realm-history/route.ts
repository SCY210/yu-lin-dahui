import {getAppUser} from '../../../lib/auth';
import {clubReadVersion,loadWithRestore} from '../../../lib/store';
import {sharedClubValue,sharedViewValidUntil} from '../../../lib/club-view-shared';
import {buildRealmHistory,realmHistoryView} from '../../../lib/realm-history';
import {RequestError} from '../../../lib/request-body';
import {writeErrorResponse} from '../../../lib/write-security';

export const dynamic='force-dynamic';
export async function GET(req:Request){try{
 const user=await getAppUser();if(!user)throw new RequestError('请先登录',401);
 const version=await clubReadVersion(user.userId);
 if(!version.settings.initialized||!version.account)throw new RequestError('仅群组道友可以查看修为明细',403);
 const playerId=new URL(req.url).searchParams.get('playerId');
 if(!playerId||playerId.length>200)throw new RequestError('球友无效');
 const {state}=await loadWithRestore({incremental:true}),account=state.accounts.find(a=>a.id===user.userId);
 if(!state.settings.initialized||!account)throw new RequestError('仅群组道友可以查看修为明细',403);
 if(!state.players.some(p=>p.id===playerId&&(!p.guestEventId||state.events.some(e=>e.id===p.guestEventId&&e.deletedAt===undefined&&(e.status!=='draft'||account.role==='admin'||e.creatorId===account.id)))))throw new RequestError('球友不存在',404);
 const now=Date.now(),history=sharedClubValue('realm-history|'+state.revision,now,()=>sharedViewValidUntil(state,now),()=>buildRealmHistory(state,now));
 return Response.json(realmHistoryView(state,account,playerId,history),{headers:{'Cache-Control':'no-store'}});
}catch(error){return writeErrorResponse(error)}}
