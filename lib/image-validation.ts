import {RequestError} from './request-body';

const maxSide=12000,maxPixels=50_000_000;
type Size={width:number;height:number};
const invalid=():never=>{throw new RequestError('照片文件格式无效，请重新选择JPEG、PNG或WebP图片',400)};
function size(width:number,height:number):Size{
 if(!width||!height)return invalid();
 if(width>maxSide||height>maxSide||width*height>maxPixels)throw new RequestError('图片尺寸过大：最长边12000像素，总像素不超过5000万',400);
 return {width,height};
}
const text=(b:Uint8Array,o:number,n=4)=>String.fromCharCode(...b.subarray(o,o+n));
const be16=(b:Uint8Array,o:number)=>b[o]*256+b[o+1];
const le16=(b:Uint8Array,o:number)=>b[o]+b[o+1]*256;
const be32=(b:Uint8Array,o:number)=>b[o]*0x1000000+b[o+1]*65536+b[o+2]*256+b[o+3];
const le24=(b:Uint8Array,o:number)=>b[o]+b[o+1]*256+b[o+2]*65536;
const le32=(b:Uint8Array,o:number)=>le24(b,o)+b[o+3]*0x1000000;
function crc32(b:Uint8Array){let crc=0xffffffff;for(const byte of b){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}return (crc^0xffffffff)>>>0}

// PNG signature and IHDR follow https://www.w3.org/TR/png-3/.
function png(b:Uint8Array):Size{
 const signature=[137,80,78,71,13,10,26,10];
 if(b.length<45||!signature.every((value,i)=>b[i]===value)||be32(b,8)!==13||text(b,12)!=='IHDR')return invalid();
 const dimensions=size(be32(b,16),be32(b,20)),depth=b[24],color=b[25];
 const depths:Record<number,number[]>={0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]};
 if(!depths[color]?.includes(depth)||b[26]!==0||b[27]!==0||b[28]>1||crc32(b.subarray(12,29))!==be32(b,29))return invalid();
 let p=8,data=false,framePixels=0;
 while(p+12<=b.length){
  const length=be32(b,p),kind=text(b,p+4),start=p+8,end=start+length;
  if(end+4>b.length)return invalid();
  if(kind==='IDAT'&&length>0)data=true;
  if(kind==='fcTL'){
   if(length!==26)return invalid();
   const frame=size(be32(b,start+4),be32(b,start+8));
   if(be32(b,start+12)+frame.width>dimensions.width||be32(b,start+16)+frame.height>dimensions.height)return invalid();
   framePixels+=frame.width*frame.height;if(framePixels>maxPixels)throw new RequestError('动态图总像素过大，请选择较小的图片',400);
  }
  if(kind==='IEND')return length===0&&data?dimensions:invalid();
  p=end+4;
 }
 return invalid();
}

function jpeg(b:Uint8Array):Size{
 if(b.length<20||b[0]!==255||b[1]!==216)return invalid();
 const frames=new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
 let p=2,dimensions:Size|undefined;
 while(p<b.length){
  if(b[p++]!==255)return invalid();while(b[p]===255)p++;
  const marker=b[p++];if(marker===undefined||marker===0||marker===0xd9)return invalid();
  if(marker===0x01||marker>=0xd0&&marker<=0xd7)continue;
  if(p+2>b.length)return invalid();const length=be16(b,p);
  if(length<2||p+length>b.length)return invalid();
  if(frames.has(marker)){
   if(length<11||![8,12,16].includes(b[p+2])||b[p+7]<1||b[p+7]>4||length<8+3*b[p+7])return invalid();
   dimensions=size(be16(b,p+5),be16(b,p+3));
  }
  if(marker===0xda){
   const components=b[p+2];if(!dimensions||components<1||components>4||length<6+2*components||p+length>=b.length)return invalid();
   // A JPEG may carry a phone's motion-photo video after its encoded image.
   // Check the frame/scan headers; do not demand EOI at the file's final byte.
   return dimensions;
  }
  p+=length;
 }
 return invalid();
}

// WebP VP8/VP8L/VP8X and animation headers follow the Google container spec:
// https://developers.google.com/speed/webp/docs/riff_container
function webpFrame(b:Uint8Array,start:number,end:number,kind:string):Size{
 if(kind==='VP8 '){
  if(end-start<11)return invalid();const tag=le24(b,start),partition=tag>>>5;
  if(tag&1||((tag>>>1)&7)>3||!(tag&16)||!partition||partition>end-start-3||b[start+3]!==0x9d||b[start+4]!==1||b[start+5]!==0x2a)return invalid();
  return size(le16(b,start+6)&0x3fff,le16(b,start+8)&0x3fff);
 }
 if(end-start<6||b[start]!==0x2f)return invalid();const bits=le32(b,start+1);if(Math.floor(bits/0x20000000)!==0)return invalid();
 return size((bits&0x3fff)+1,((bits>>>14)&0x3fff)+1);
}
function chunks(b:Uint8Array,start:number,end:number,visit:(kind:string,start:number,end:number)=>void){
 let p=start;while(p<end){if(p+8>end)return invalid();const kind=text(b,p),length=le32(b,p+4),data=p+8,next=data+length+(length&1);if(next>end||length&1&&b[next-1]!==0)return invalid();visit(kind,data,data+length);p=next}
}
function webp(b:Uint8Array):Size{
 if(b.length<26||text(b,0)!=='RIFF'||text(b,8)!=='WEBP')return invalid();
 const end=le32(b,4)+8;if(end>b.length||end<20||end&1)return invalid();
 let canvas:Size|undefined,frame:Size|undefined,animated=false,animationHeader=false,animatedFrames=0,totalPixels=0;
 chunks(b,12,end,(kind,start,stop)=>{
  if(kind==='VP8X'){
   if(canvas||stop-start!==10)return invalid();canvas=size(le24(b,start+4)+1,le24(b,start+7)+1);animated=!!(b[start]&2);
  }else if(kind==='ANIM'){
   if(stop-start!==6)return invalid();animationHeader=true;
  }else if(kind==='VP8 '||kind==='VP8L'){
   if(frame||animatedFrames)return invalid();frame=webpFrame(b,start,stop,kind);
  }else if(kind==='ANMF'){
   if(!canvas||!animated||!animationHeader||stop-start<16)return invalid();
   const declared=size(le24(b,start+6)+1,le24(b,start+9)+1),x=le24(b,start)*2,y=le24(b,start+3)*2;
   if(x+declared.width>canvas.width||y+declared.height>canvas.height)return invalid();
   let decoded:Size|undefined;chunks(b,start+16,stop,(sub,a,z)=>{if(sub==='VP8 '||sub==='VP8L'){if(decoded)return invalid();decoded=webpFrame(b,a,z,sub)}});
   if(!decoded||decoded.width!==declared.width||decoded.height!==declared.height)return invalid();
   totalPixels+=declared.width*declared.height;if(totalPixels>maxPixels)throw new RequestError('动态图总像素过大，请选择较小的图片',400);animatedFrames++;
  }
 });
 if(animated)return animatedFrames>0&&canvas?canvas:invalid();
 if(!frame)return invalid();if(canvas&&(canvas.width!==frame.width||canvas.height!==frame.height))return invalid();return canvas??frame;
}

/** Structural container/frame validation without an unbounded image decode. */
export function validateImage(bytes:Uint8Array,declaredType:string){
 const type=declaredType.toLowerCase();let dimensions:Size;
 if(type==='image/png')dimensions=png(bytes);
 else if(type==='image/jpeg')dimensions=jpeg(bytes);
 else if(type==='image/webp')dimensions=webp(bytes);
 else return invalid();
 return {type,...dimensions};
}
