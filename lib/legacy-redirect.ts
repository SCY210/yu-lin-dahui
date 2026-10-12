/** A configured legacy origin becomes an entry point, never a second writable backend. */
export function legacySiteRedirect(request:Request,configured?:string):Response|null{
 if(!configured)return null;
 const incoming=new URL(request.url);let destination:URL;
 try{
  destination=new URL(configured);
  if(destination.protocol!=='https:'||destination.username||destination.password||destination.pathname!=='/'||destination.search||destination.hash||destination.origin===incoming.origin)throw Error('Invalid canonical origin');
 }catch{return Response.json({error:'网站入口配置暂不可用，请联系管理员'},{status:503,headers:{'Cache-Control':'no-store'}})}
 // Temporary read-only operator exports retain their own expiring-token guard.
 if(incoming.pathname.startsWith('/_operator/migration/'))return null;
 const target=new URL(incoming.pathname+incoming.search,destination.origin);
 const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
 if(!['GET','HEAD'].includes(request.method)||incoming.pathname==='/api'||incoming.pathname.startsWith('/api/'))
  return Response.json({error:'旧站已迁移，请刷新页面前往新站后继续操作。未提交本次修改。',siteMovedTo:destination.origin,redirectRequired:true},{status:410,headers});
 // Keep existing installed clients able to update their service worker/static shell.
 if(incoming.pathname.startsWith('/_next/static/')||['/sw.js','/offline.html','/manifest.webmanifest','/favicon.ico'].includes(incoming.pathname)||incoming.pathname.startsWith('/icons/'))return null;
 return new Response(null,{status:307,headers:{...headers,Location:target.href}});
}
