/** Starting a later planned round must not reset its clock to the event start. */
export function roundStartTime(event:{start:number},round:{start:number},now=Date.now()){
 return Math.max(event.start,round.start,now);
}
