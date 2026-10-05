export class RequestError extends Error{
 constructor(message:string,public status=400){super(message);this.name='RequestError'}
}

/** Bound the actual stream, including requests with no Content-Length header. */
async function readBytes(req:Request,maxBytes:number){
 const length=Number(req.headers.get('content-length'));
 if(length>maxBytes)throw new RequestError('请求资料过大，请减少内容后重试',413);
 const reader=req.body?.getReader();if(!reader)return new Uint8Array(0);
 const chunks:Uint8Array[]=[];let size=0;
 try{
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new RequestError('请求资料过大，请减少内容后重试',413)}chunks.push(value)}
 }finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
 return bytes;
}
export async function readJsonBody(req:Request,maxBytes=64*1024):Promise<unknown>{
 const bytes=await readBytes(req,maxBytes);
 try{return JSON.parse(new TextDecoder().decode(bytes))}catch{throw new RequestError('请求格式无效，请刷新后重试')}
}
export async function readPhotoForm(req:Request){
 const bytes=await readBytes(req,6*1024*1024);
 try{return await new Response(bytes,{headers:{'Content-Type':req.headers.get('content-type')??''}}).formData()}catch{throw new RequestError('照片资料格式无效，请重新选择照片')}
}
