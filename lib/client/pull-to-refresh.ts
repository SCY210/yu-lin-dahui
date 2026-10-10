/** Pull-to-refresh for the home-screen app, which has no browser pull gesture of its own. */
export const pullThreshold=72,pullMax=110;
/** Finger travel is damped by half and capped; the gesture is ready to refresh once it passes the threshold. */
export function pullProgress(fingerTravel:number){
 const distance=fingerTravel<=0?0:Math.min(pullMax,fingerTravel*0.5);
 return {distance,ready:distance>=pullThreshold};
}
export function isStandaloneApp(){
 return matchMedia('(display-mode: standalone)').matches||!!(navigator as Navigator&{standalone?:boolean}).standalone;
}
type Box={parentElement:Box|null;scrollTop:number;closest?:(selector:string)=>unknown};
/** A pull starts only from the top of the page, outside dialogs and opted-out areas, and not inside a scrolled box. */
export function pullBlocked(target:Box|null,isScrollable:(el:Box)=>boolean){
 if(target?.closest?.('[role="dialog"],dialog,[data-no-pull-refresh]'))return true;
 for(let el=target;el;el=el.parentElement)if(isScrollable(el)&&el.scrollTop>0)return true;
 return false;
}
