import {getAppUser} from '../../../lib/auth';
import {clubReadVersion,loadWithRestore} from '../../../lib/store';
import {auditLogPage} from '../../../lib/audit-log';
import {RequestError} from '../../../lib/request-body';
import {writeErrorResponse} from '../../../lib/write-security';

export const dynamic='force-dynamic';
export async function GET(req:Request){try{
 const user=await getAppUser();if(!user)throw new RequestError('请先登录',401);
 const version=await clubReadVersion(user.userId);
 if(!version.settings.initialized||version.account?.role!=='admin')throw new RequestError('仅宗主或副宗主可以查看操作日志',403);
 const {state}=await loadWithRestore({incremental:true}),account=state.accounts.find(a=>a.id===user.userId);
 // Recheck permissions in the snapshot used for the actual rows.
 if(!state.settings.initialized||account?.role!=='admin')throw new RequestError('仅宗主或副宗主可以查看操作日志',403);
 return Response.json(auditLogPage(state,account,Date.now(),new URL(req.url).searchParams.get('cursor')),{headers:{'Cache-Control':'no-store'}});
}catch(error){return writeErrorResponse(error)}}
