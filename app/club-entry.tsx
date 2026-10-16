'use client';
import {lazy,Suspense,useSyncExternalStore} from 'react';
import AppLoading from './app-loading';

// The initial application has no data until its authenticated API read completes.
// Keep its large module graph out of the Worker's SSR path; hydration still starts
// the same application and retains its immediate read / three-second live polling.
const ClubApp=lazy(()=>import('./club-app'));
const subscribe=()=>()=>{};
const clientSnapshot=()=>true,serverSnapshot=()=>false;
export default function ClubEntry(){
 const mounted=useSyncExternalStore(subscribe,clientSnapshot,serverSnapshot);
 return mounted?<Suspense fallback={<AppLoading/>}><ClubApp/></Suspense>:<AppLoading/>;
}
