import {aquariumAccess} from '../../../../../lib/theme-access-server';
import {aquariumArt} from '../../../../../lib/aquarium-art';
import {publicApiError} from '../../../../../lib/api-error';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{
 const access=await aquariumAccess();
 if(!access.allowed)return new Response('此主题仅限指定球友使用',{status:access.signedIn?403:401,headers:{'Cache-Control':'no-store'}});
 const kind=new URL(req.url).searchParams.get('kind');
 if(kind!=='hero'&&kind!=='mascot'&&kind!=='friends')return new Response('素材不存在',{status:404,headers:{'Cache-Control':'no-store'}});
 const bytes=Uint8Array.from(atob(aquariumArt[kind]),c=>c.charCodeAt(0));
 return new Response(bytes,{headers:{'Content-Type':'image/webp','Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});
 }catch(e){const safe=publicApiError(e);return Response.json({error:safe.error},{status:safe.status,headers:{'Cache-Control':'no-store'}})}}
