/** 太极 mark for loading and refreshing (styles in app/xiuxian-fx.css). `turn` rotates it by hand, for the pull gesture. */
export default function Taiji({size=18,still=false,turn}:{size?:number;still?:boolean;turn?:number}){
 return <svg className={'xx-taiji'+(still||turn!==undefined?' is-still':'')} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false" style={turn!==undefined?{transform:`rotate(${turn}deg)`}:undefined}>
  <circle className="xx-yin" cx="16" cy="16" r="15"/>
  <path className="xx-yang" d="M16 1a15 15 0 0 1 0 30a7.5 7.5 0 0 1 0-15a7.5 7.5 0 0 0 0-15Z"/>
  <circle className="xx-yang" cx="16" cy="8.5" r="2.4"/><circle className="xx-yin" cx="16" cy="23.5" r="2.4"/>
  <circle className="xx-rim" cx="16" cy="16" r="15"/>
 </svg>;
}
