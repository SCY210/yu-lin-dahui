import {getChatGPTUser} from '../../../chatgpt-auth';
import {blockedLegacyIdentity, cancelAccountDeletion, deletionRequest} from '../../../../lib/account-lifecycle';
import {writeErrorResponse} from '../../../../lib/write-security';

export async function GET(req: Request) {
  try {
    const origin = new URL(req.url).origin;
    if (req.headers.get('sec-fetch-site') === 'cross-site' || (req.headers.has('origin') && req.headers.get('origin') !== origin)) return Response.json({error: '请从登录页确认身份'}, {status: 403});
    const user = await getChatGPTUser();
    if (!user || await blockedLegacyIdentity(user.userId)) return Response.json({error: '账号不可用'}, {status: 401, headers: {'Cache-Control': 'no-store'}});
    // Normal legacy initialization may have no club account yet.
    if (await deletionRequest(user.userId)) await cancelAccountDeletion(user.userId);
    const h = new Headers({Location: '/', 'Cache-Control': 'no-store'});
    for (const name of ['yulin_signed_out','yulin_session']) h.append('Set-Cookie', `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${new URL(req.url).protocol === 'https:' ? '; Secure' : ''}`);
    return new Response(null, {status: 303, headers: h});
  } catch (error) {return writeErrorResponse(error);}
}
