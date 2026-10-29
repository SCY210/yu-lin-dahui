import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fmt,hm,euro} from '../app/form-fields';

test('shared formatters preserve dates, Madrid DST, option overrides and euro rounding',()=>{
 const dates=['2026-03-29T00:30:00Z','2026-03-29T01:30:00Z','2026-10-25T00:30:00Z','2026-10-25T01:30:00Z'].map(Date.parse);
 const options:Intl.DateTimeFormatOptions[]=[
  {month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'},
  {year:'numeric',month:'long',day:'numeric',weekday:'long'},
  {hour:'2-digit',minute:'2-digit'},
  {timeZone:'UTC',dateStyle:'full',timeStyle:'short'},
  {timeZone:undefined,year:'numeric',month:'2-digit',day:'2-digit'},
 ];
 for(const at of dates){
  for(const opts of options)assert.equal(fmt(at,opts),new Intl.DateTimeFormat('zh-CN',{timeZone:'Europe/Madrid',...opts}).format(at));
  assert.equal(fmt(at),new Intl.DateTimeFormat('zh-CN',{timeZone:'Europe/Madrid',...options[0]}).format(at));
  assert.equal(hm(at),fmt(at,options[2]));
 }
 const currency=new Intl.NumberFormat('zh-CN',{style:'currency',currency:'EUR'});
 for(const cents of [0,-1,1,125,-125,1234567,12.5])assert.equal(euro(cents),currency.format(cents/100));
 assert.throws(()=>fmt(Number.NaN),RangeError);
 assert.throws(()=>fmt(0,{timeZone:'Invalid/Timezone'}),RangeError);
});

test('repeated rows reuse formatters and changing options cannot reuse stale formatting',()=>{
 const original=Intl.DateTimeFormat,originalNumber=Intl.NumberFormat;
 let dates=0,numbers=0;
 Intl.DateTimeFormat=new Proxy(original,{construct(target,args){dates++;return Reflect.construct(target,args)}});
 Intl.NumberFormat=new Proxy(originalNumber,{construct(target,args){numbers++;return Reflect.construct(target,args)}});
 try{
  const options:Intl.DateTimeFormatOptions={hour:'numeric',second:'numeric',hourCycle:'h24'};
  for(let row=0;row<500;row++){
   fmt(row*1000,options);
   fmt(row*1000,{second:'numeric',hourCycle:'h24',hour:'numeric'});
   euro(row);
  }
  assert.equal(dates,1,'1,000 date cells with equivalent options construct only one formatter');
  assert.equal(numbers,0,'currency rows reuse their singleton formatter');
  options.hourCycle='h12';
  assert.equal(fmt(0,options),new original('zh-CN',{timeZone:'Europe/Madrid',...options}).format(0));
  assert.equal(dates,2,'mutating an options object selects a new formatter');

  const first:Intl.DateTimeFormatOptions={hour:'numeric',second:'numeric',hourCycle:'h24'};
  for(const timeZone of ['UTC','Europe/Madrid','America/New_York','Asia/Tokyo','Australia/Sydney'])
   for(const month of ['numeric','long'] as const)
    for(const day of ['numeric','2-digit'] as const)
     for(const hour12 of [true,false])fmt(0,{timeZone,month,day,hour12,second:'numeric'});
  const before=dates;fmt(0,first);
  assert.equal(dates,before+1,'old option combinations are evicted instead of retaining unbounded ICU state');
 }finally{Intl.DateTimeFormat=original;Intl.NumberFormat=originalNumber}
});
