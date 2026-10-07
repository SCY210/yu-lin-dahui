'use client';
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {ThemeProvider,useTheme} from 'next-themes';
import {Palette} from 'lucide-react';
import {syncThemeBrand} from '../lib/client/theme-brand';
import './visual-theme.css';

const AquariumPermission=createContext(false);
export function VisualThemeProvider({children,aquariumAllowed=false,aquariumDefault=false}:{children:ReactNode;aquariumAllowed?:boolean;aquariumDefault?:boolean}){
 const themes=aquariumAllowed?['classic','wuxia','aquarium']:['classic','wuxia'];
 return <AquariumPermission.Provider value={aquariumAllowed}><ThemeProvider attribute="class" themes={themes} value={{classic:'classic-theme',wuxia:'wuxia-theme',aquarium:'aquarium-theme'}} defaultTheme={aquariumDefault?'aquarium':'classic'} storageKey={aquariumDefault?'yulin-queen-ui-theme':aquariumAllowed?'yulin-owner-ui-theme':'yulin-ui-theme'} enableSystem={false} enableColorScheme={false} disableTransitionOnChange>
  {aquariumAllowed&&<link rel="stylesheet" href="/api/theme/aquarium"/>}<ThemeBrowserColor/>{children}
 </ThemeProvider></AquariumPermission.Provider>;
}

function ThemeBrowserColor(){
 const {theme,setTheme}=useTheme();
 const allowed=useContext(AquariumPermission);
 useEffect(()=>{
  if(!theme)return;
  if(theme!=='classic'&&theme!=='wuxia'&&!(theme==='aquarium'&&allowed)){setTheme('classic');return;}
  syncThemeBrand(document,theme);
 },[theme,allowed,setTheme]);
 return null;
}

export function ThemeSwitcher(){
 const {theme,setTheme}=useTheme(),[mounted,setMounted]=useState(false);
 const allowed=useContext(AquariumPermission);
 const selected=mounted?(theme==='aquarium'&&allowed?'aquarium':theme==='wuxia'?'wuxia':'classic'):'classic';
 useEffect(()=>setMounted(true),[]);
 return <label className="visual-theme-picker">{mounted&&theme==='aquarium'&&allowed?<img className="aquarium-theme-icon" src="/api/theme/aquarium/art?kind=mascot" width={44} height={44} alt="" aria-hidden="true"/>:<Palette size={16} aria-hidden="true"/>}
  <select aria-label="切换主题" title="切换主题，并记住这台设备的选择" value={selected} disabled={!mounted} onChange={event=>{const value=event.target.value;if(value==='classic'||value==='wuxia'||(value==='aquarium'&&allowed))setTheme(value)}}>
   <option value="classic">清雅原版</option><option value="wuxia">水墨江湖</option>{allowed&&<option value="aquarium">粉粉水族馆</option>}
  </select>
 </label>;
}

export function useVisualTheme(){return useTheme().theme==='wuxia'}

export function useAquariumTheme(){const allowed=useContext(AquariumPermission),{theme}=useTheme();return allowed&&theme==='aquarium'}
