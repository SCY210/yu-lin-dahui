'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {ThemeProvider,useTheme} from 'next-themes';
import {Palette} from 'lucide-react';
import {syncThemeBrand} from '../lib/client/theme-brand';
import './visual-theme.css';

export function VisualThemeProvider({children}:{children:ReactNode}){
 return <ThemeProvider attribute="class" themes={['classic','wuxia']} value={{classic:'classic-theme',wuxia:'wuxia-theme'}} defaultTheme="classic" storageKey="yulin-ui-theme" enableSystem={false} enableColorScheme={false} disableTransitionOnChange>
  <ThemeBrowserColor/>{children}
 </ThemeProvider>;
}

function ThemeBrowserColor(){
 const {theme,setTheme}=useTheme();
 useEffect(()=>{
  if(!theme)return;
  if(theme!=='classic'&&theme!=='wuxia'){setTheme('classic');return;}
  syncThemeBrand(document,theme);
 },[theme,setTheme]);
 return null;
}

export function ThemeSwitcher(){
 const {theme,setTheme}=useTheme(),[mounted,setMounted]=useState(false);
 const selected=mounted&&theme==='wuxia'?'wuxia':'classic';
 useEffect(()=>setMounted(true),[]);
 return <label className="visual-theme-picker"><Palette size={16} aria-hidden="true"/>
  <select aria-label="切换主题" title="切换主题，并记住这台设备的选择" value={selected} disabled={!mounted} onChange={event=>{const value=event.target.value;if(value==='classic'||value==='wuxia')setTheme(value)}}>
   <option value="classic">清雅原版</option><option value="wuxia">水墨江湖</option>
  </select>
 </label>;
}

export function useVisualTheme(){return useTheme().theme==='wuxia'}
