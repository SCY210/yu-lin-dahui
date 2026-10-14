/** Continuous cel-shaded fire, with the approved compact plume and thin tip. */
export const avatarFireVertex='attribute vec2 position;void main(){gl_Position=vec4(position,0.,1.);}';
export const avatarFireFragment=`precision highp float;
uniform vec2 resolution;
uniform float time;
uniform float embers;
uniform float square;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(.8,-.6,.6,.8);for(int i=0;i<5;i++){v+=a*noise(p);p=m*p*2.03+vec2(5.7,3.1);a*=.5;}return v;}
float softNoise(vec2 p){return .6*noise(p)+.28*noise(p*1.97+vec2(5.7,3.1))+.12*noise(p*3.91+vec2(2.3,7.1));}
void main(){
 vec2 p=(gl_FragCoord.xy-.5*resolution)/resolution.y;p.y+=.065;
 float t=time,r=mix(length(p),max(abs(p.x),abs(p.y)),square),a=atan(p.y,p.x);
 float wind=.034*sin(p.y*11.-t*1.7)+.026*sin(p.y*19.+t*.9);
 vec2 adv=vec2(p.x*7.,p.y*5.8-t*1.1);
 vec2 curl=vec2(fbm(adv+vec2(1.7,3.1)),fbm(adv+vec2(6.9,1.3)))-.5;
 float turbulence=softNoise(adv+curl*3.2);
 float h=max(p.y,0.);
 float tip=smoothstep(.16,.36,h);
 float taper=max(.018,(.195-h*.3)*(1.-.52*tip));
 float column=exp(-pow(abs((p.x+wind+curl.x*.055*(1.-.3*tip))/taper),2.)*1.5)*max(0.,1.-h/.45);
 column*=smoothstep(-.2,-.1,p.y);
 float rim=exp(-pow((r-.178)/.025,2.))*(.72+.3*noise(vec2(a*3.,t*1.5)));
 float envelope=smoothstep(.025,.18,max(column,rim));
 float strength=max(column*.88,rim*.58)+(turbulence-.5)*.62*envelope;
 float opacity=smoothstep(.165,.235,strength)*smoothstep(.16,.177,r)*smoothstep(-.25,-.19,p.y);
 float heat=clamp((strength-.2)*2.8,0.,1.);
 vec3 red=vec3(1.,.17,.018),orange=vec3(1.,.49,.035),gold=vec3(1.,.86,.26),white=vec3(1.,.98,.75);
 vec3 color=mix(red,orange,step(.1,heat));color=mix(color,gold,step(.38,heat));color=mix(color,white,step(.78,heat));
 float halo=exp(-pow((r-.185)/.05,2.))*.075*smoothstep(.16,.185,r);
 float sparks=0.;
 for(int i=0;i<5;i++){float k=float(i);float life=fract(t*(.19+k*.014)+k*.173);float sy=-.025+life*.38;float sx=sin(k*16.7)*(.145+life*.045)+sin(life*5.+k)*.022;float d=length((p-vec2(sx,sy))*vec2(1.,.65));sparks+=exp(-d*d/.000008)*sin(life*3.14159)*.65;}
 sparks*=embers;
 float alpha=clamp(opacity+halo+sparks,0.,1.);
 vec3 outColor=(color*opacity+orange*halo+gold*sparks)/max(alpha,.0001);
 gl_FragColor=vec4(outColor,alpha);
}`;
