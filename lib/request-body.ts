export class RequestError extends Error{
 constructor(message:string,public status=400){super(message);this.name='RequestError'}
}

/** Bound bytes and total read time, including chunked or stalled requests. */
async function readBytes(req:Request,maxBytes:number,timeoutMs:number){
 const length=Number(req.headers.get('content-length'));
 if(length>maxBytes)throw new RequestError('请求资料过大，请减少内容后重试',413);
 const reader=req.body?.getReader();if(!reader)return new Uint8Array(0);
 const chunks:Uint8Array[]=[];let size=0,complete=false;
 const deadline=Date.now()+timeoutMs;
 const timeout=()=>new RequestError('请求上传超时，请重新提交',408);
 let timer:ReturnType<typeof setTimeout>|undefined;
 let onAbort:()=>void=()=>{};
 const interrupted=new Promise<never>((_,reject)=>{
  timer=setTimeout(()=>reject(timeout()),timeoutMs);
  onAbort=()=>reject(new RequestError('请求已中断，请重新提交'));
  req.signal.addEventListener('abort',onAbort,{once:true});
 });
 try{
  if(req.signal.aborted)onAbort();
  for(;;){
   // Receiving another chunk never extends the absolute deadline.
   if(Date.now()>=deadline)throw timeout();
   const {done,value}=await Promise.race([reader.read(),interrupted]);
   if(Date.now()>=deadline)throw timeout();
   if(done){complete=true;break}
   size+=value.byteLength;
   if(size>maxBytes)throw new RequestError('请求资料过大，请减少内容后重试',413);
   chunks.push(value);
  }
 }finally{
  if(timer!==undefined)clearTimeout(timer);
  req.signal.removeEventListener('abort',onAbort);
  // Cancellation can itself stall (for example a tee's other branch). It must
  // not delay the error response or retain the reader lock.
  if(!complete)void reader.cancel().catch(()=>{});
  reader.releaseLock();
 }
 const bytes=new Uint8Array(size);let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
 return bytes;
}
export async function readJsonBody(req:Request,maxBytes=64*1024):Promise<unknown>{
 const bytes=await readBytes(req,maxBytes,10_000);
 try{return JSON.parse(new TextDecoder().decode(bytes))}catch{throw new RequestError('请求格式无效，请刷新后重试')}
}
export async function readPhotoForm(req:Request){
 const bytes=await readBytes(req,6*1024*1024,30_000);
 try{return await new Response(bytes,{headers:{'Content-Type':req.headers.get('content-type')??''}}).formData()}catch{throw new RequestError('照片资料格式无效，请重新选择照片')}
}
