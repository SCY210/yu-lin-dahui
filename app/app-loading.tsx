import './app-loading.css';

/** Opening screen while club data loads: the app icon's shuttlecock emblem in motion
 * (scripts/brand-icon-art.mjs). Rendered on the server, so it shows before scripts start. */
export default function AppLoading({message='正在读取群组数据'}:{message?:string}){
 return <main className="app-loading" role="status" aria-live="polite">
  <div className="al-tile" aria-hidden="true">
   <svg viewBox="0 0 256 256" className="al-mark" fill="none">
    <defs>
     <linearGradient id="al-feather" x1="88" y1="62" x2="164" y2="152" gradientUnits="userSpaceOnUse"><stop className="al-white"/><stop offset=".65" className="al-white"/><stop offset="1" className="al-shade"/></linearGradient>
     <linearGradient id="al-cork" x1="113" y1="149" x2="143" y2="188" gradientUnits="userSpaceOnUse"><stop className="al-white"/><stop offset="1" className="al-shade"/></linearGradient>
    </defs>
    <path className="al-orbit" d="M51 147c-17 37 8 68 51 67 22 0 50-10 76-32"/>
    <path className="al-swing" pathLength={1} d="M59 158c-7 31 15 47 46 44 16-1 33-8 48-18"/>
    <g className="al-fly">
     <g transform="rotate(34 128 128)">
      <path d="M70 85q-4-7 2-12l7-4q5-3 9 4l29 69-9 7-38-64Z" fill="url(#al-feather)"/>
      <path d="M92 68q-2-7 5-9l9-2q7-1 9 7l9 76-11 5-21-77Z" fill="url(#al-feather)"/>
      <path d="M118 59q0-7 7-7h6q7 0 7 7l-4 82h-12l-4-82Z" fill="url(#al-feather)"/>
      <path d="M141 64q2-8 9-7l9 2q7 2 5 9l-21 77-11-5 9-76Z" fill="url(#al-feather)"/>
      <path d="M168 73q4-7 9-4l7 4q6 5 2 12l-38 64-9-7 29-69Z" fill="url(#al-feather)"/>
      <path className="al-vanes" d="m81 82 32 61m-10-75 17 72m8-75v74m25-71-17 72m39-58-32 61"/>
      <path className="al-collar" d="M106 145q22-7 44 0l-3 12h-38l-3-12Z"/>
      <path className="al-band" d="M109 151h38"/>
      <path d="M110 158h36v14c0 12-7 19-18 19s-18-7-18-19v-14Z" fill="url(#al-cork)"/>
     </g>
    </g>
    <path className="al-spark" d="m191 58 2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Z"/>
   </svg>
  </div>
  <p className="al-title">羽林大会</p>
  <p className="al-message">{message}…</p>
  <span className="al-track" aria-hidden="true"><i/></span>
 </main>;
}
