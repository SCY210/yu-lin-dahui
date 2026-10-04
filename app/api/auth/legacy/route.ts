export async function GET(req:Request){
 const origin=new URL(req.url).origin;
 if(req.headers.get('sec-fetch-site')==='cross-site'||(req.headers.get('origin')&&req.headers.get('origin')!==origin))return Response.json({error:'请从登录页确认原账号身份'},{status:403});
 return new Response(null,{status:303,headers:{Location:'/signin-with-chatgpt?return_to=%2F','Set-Cookie':`yulin_signed_out=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${new URL(req.url).protocol==='https:'?'; Secure':''}`,'Cache-Control':'no-store'}})
}
