/**
 * Clear browser cookies from a different branch before the existing local
 * sign-in helper runs. This middleware is registered only for test serve mode.
 * @param {string} origin
 */
export function localTestLoginMiddleware(origin) {
  /** @param {import('node:http').IncomingMessage} request
   * @param {import('node:http').ServerResponse} response
   * @param {()=>void} next
   */
  return (request,response,next)=>{
    if(request.url?.split('?')[0]!=='/__local-test/login'){next();return}
    const localAddresses=new Set(['127.0.0.1','::1','::ffff:127.0.0.1']);
    const permitted=request.method==='GET'
      && 'http://'+request.headers.host===origin
      && localAddresses.has(request.socket.remoteAddress??'')
      && request.headers['sec-fetch-site']!=='cross-site'
      && (!request.headers.origin||request.headers.origin===origin);
    response.setHeader('Cache-Control','private, no-store');
    if(!permitted){response.statusCode=403;response.end();return}
    response.statusCode=302;
    response.setHeader('Set-Cookie',[
      'yulin_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax',
      'yulin_signed_out=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax',
    ]);
    response.setHeader('Location','/signin-with-chatgpt');
    response.end();
  };
}

/** @returns {import('vite').Plugin} */
export function localTestLogin(origin) {
  return {
    name:'local-test-login',
    apply:'serve',
    /** @param {import('vite').ViteDevServer} server */
    configureServer(server){server.middlewares.use(localTestLoginMiddleware(origin))},
  };
}
