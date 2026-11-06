import {photoUrl} from '../lib/photo-url';

/** Start the selected portrait while the profile's lazy modules are downloading. */
export default function ProfileImagePreload({player}:{player?:{avatarId?:string;guest?:boolean;guestEventId?:string}}){
 if(!player?.avatarId||player.guest||player.guestEventId)return null;
 return <link rel="preload" as="image" href={photoUrl(player.avatarId,'avatar')} fetchPriority="high"/>;
}
