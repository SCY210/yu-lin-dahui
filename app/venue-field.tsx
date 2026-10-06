'use client';
import {MapPin} from 'lucide-react';
import {venues,findVenue,googleMapsUrl} from '../lib/venues';
import './native-form-select.css';
export default function VenueField({value,address,mapUrl,onChange}: {value:string;address:string;mapUrl?:string;onChange:(venue:string,address:string)=>void}){const current=findVenue(value),legacy=!!value&&!current,displayedAddress=current?.address??address;return <div className="venue-field"><select className="pick native-form-select" aria-label="球馆" required value={current?.name??(legacy?'legacy':'')} onChange={ev=>{const name=ev.target.value;if(name==='legacy')return;const v=findVenue(name);if(v)onChange(v.name,v.address)}}><option value="" disabled>请选择球馆</option>{venues.map(v=><option key={v.id} value={v.name}>{v.name}</option>)}{legacy&&<option value="legacy">{value}（当前记录）</option>}</select>{displayedAddress&&<a className="venue-address" href={mapUrl??googleMapsUrl(value,displayedAddress)} target="_blank" rel="noopener noreferrer"><MapPin size={17}/><span>{displayedAddress}<small>打开地图导航</small></span></a>}</div>}

