import {aquariumAccess} from '../../../../lib/theme-access-server';
import {aquariumCss} from '../../../../lib/aquarium-theme-css';
import {publicApiError} from '../../../../lib/api-error';
export const dynamic='force-dynamic';
export async function GET(){try{
 const access=await aquariumAccess();
 if(!access.allowed)return new Response('此主题仅限指定球友使用',{status:access.signedIn?403:401,headers:{'Cache-Control':'no-store'}});
 return new Response(aquariumCss,{headers:{'Content-Type':'text/css; charset=utf-8','Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});
 }catch(e){const safe=publicApiError(e);return Response.json({error:safe.error},{status:safe.status,headers:{'Cache-Control':'no-store'}})}}
