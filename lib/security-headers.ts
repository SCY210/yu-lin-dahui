// Limit embedding to this site and the official hosts used by Sites previews.
// Script/style restrictions need per-request nonces for Vinext's inline bootstrap.
export const securityHeaders=[
 {key:'X-Content-Type-Options',value:'nosniff'},
 {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
 {key:'Content-Security-Policy',value:"object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com https://openai.com https://*.openai.com"},
 {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=(), payment=(), usb=()'},
 {key:'Strict-Transport-Security',value:'max-age=31536000'},
];

// The custom Sites Worker does not consistently apply next.config headers.
// Wrap its response directly while preserving the stream and all cookie headers.
export function secureResponse(response:Response,request:Request):Response {
 const headers=new Headers(response.headers);
 for(const {key,value} of securityHeaders)headers.set(key,value);
 const pathname=new URL(request.url).pathname;
 if(pathname==='/'||pathname==='/api'||pathname.startsWith('/api/'))headers.set('Cache-Control','private, no-store');
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
