export function rankingQuarter(period:string){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))throw new Error('无效排名月份');
 return period.slice(0,4)+'-Q'+Math.ceil(Number(period.slice(5))/3);
}
export function quarterMonths(quarter:string){
 const match=/^(\d{4})-Q([1-4])$/.exec(quarter);if(!match)throw new Error('无效排名季度');
 const first=(Number(match[2])-1)*3+1;
 return Array.from({length:3},(_,i)=>match[1]+'-'+String(first+i).padStart(2,'0'));
}
export function quarterLabel(quarter:string){const months=quarterMonths(quarter);return quarter.slice(0,4)+'年第'+quarter.slice(-1)+'季度（'+Number(months[0].slice(5))+'–'+Number(months[2].slice(5))+'月）'}
