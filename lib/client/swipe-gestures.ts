/** Touch gestures for phones (docs/GESTURES.md): a swipe in from the left edge goes back, and a horizontal swipe on an
 * activity page moves to the neighbouring tab. Pure decisions live here so they can be tested without a browser. */
export const edgeWidth=28,backDistance=72,backMax=110,tabDistance=64;

/** How far the back indicator has been pulled. The gesture only counts while it stays mostly horizontal. */
export function edgeBackProgress(startX:number,dx:number,dy:number){
 if(startX>edgeWidth||dx<=0||Math.abs(dy)>Math.max(40,dx))return {distance:0,ready:false};
 const distance=Math.min(backMax,dx);
 return {distance,ready:distance>=backDistance};
}
/** -1 for the previous tab (finger moves right), 1 for the next (finger moves left), 0 when the swipe does not count. */
export function tabSwipeStep(dx:number,dy:number):-1|0|1{
 if(Math.abs(dx)<tabDistance||Math.abs(dx)<Math.abs(dy)*1.8)return 0;
 return dx<0?1:-1;
}
/** The neighbouring tab a swipe leads to, or undefined at either end. */
export function neighbourTab<T>(tabs:readonly T[],active:T,step:-1|0|1){
 const index=tabs.indexOf(active);
 return step===0||index<0?undefined:tabs[index+step];
}
type Box={parentElement:Box|null;closest?:(selector:string)=>unknown};
const controls='input,textarea,select,[contenteditable="true"],[role="slider"],[data-no-swipe],.referee-console,.live-board';
/** Scoring screens and fields keep every touch to themselves. */
export function backSwipeBlocked(target:Box|null){return !!target?.closest?.(controls)}
/** A tab swipe also leaves dialogs alone, and anything that scrolls sideways (tables, brackets, avatar rows). */
export function tabSwipeBlocked(target:Box|null,scrollsSideways:(el:Box)=>boolean){
 if(target?.closest?.(controls+',[role="dialog"],[role="alertdialog"],dialog,[role="tablist"],.bottom-nav'))return true;
 for(let el=target;el;el=el.parentElement)if(scrollsSideways(el))return true;
 return false;
}
