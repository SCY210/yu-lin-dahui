// Names follow the user's supplied venue list; public addresses checked on 2026-10-04.
export const venues = [
 {id:'antonio-diaz-miguel',name:'Antonio Díaz Miguel',address:'Calle de Joaquín Dicenta, 1, 28029 Madrid',district:'Tetuán'},
 {id:'daoiz-velarde',name:'Daoíz y Velarde',address:'Plaza de Daoíz y Velarde, 5, 28007 Madrid',district:'Retiro'},
 {id:'felix-rubio',name:'Félix Rubio',address:'Calle de la Alianza, 4, 28041 Madrid',district:'Villaverde'},
 {id:'fernando-martin',name:'Fernando Martín',address:'Avenida de Santo Ángel de la Guarda, 6, 28039 Madrid',district:'Moncloa-Aravaca'},
 {id:'gimnasio-moscardo',name:'Gimnasio Moscardó',address:'Calle del Pilar de Zaragoza, 93, 28028 Madrid',district:'Salamanca'},
 {id:'hortaleza',name:'Hortaleza',address:'Carretera de la Estación de Hortaleza, 11, 28033 Madrid',district:'Hortaleza'},
 {id:'la-elipa',name:'La Elipa',address:'Calle del Alcalde Garrido Juaristi, 17, 28030 Madrid',district:'Moratalaz'},
 {id:'la-fundi',name:'La Fundi',address:'Calle de Alicante, 14, 28045 Madrid',district:'Arganzuela'},
 {id:'marques-samaranch',name:'Marqués de Samaranch',address:'Paseo Imperial, 20, 28005 Madrid',district:'Arganzuela'},
 {id:'orcasur',name:'Orcasur',address:'Calle de Moreja, 11, 28041 Madrid',district:'Usera'},
 {id:'pradillo',name:'Pradillo',address:'Calle de Pradillo, 33, 28002 Madrid',district:'Chamartín'},
] as const;
const normalize=(s:string)=>s.normalize('NFD').replace(/\p{M}/gu,'').trim().toLowerCase();
export function findVenue(name:string){return venues.find(v=>normalize(v.name)===normalize(name)||v.id===name)}
export function googleMapsUrl(name:string,address:string){const venue=findVenue(name);const location=(venue?.address||address||'Madrid').trim();const label=venue?.name??name.trim();const params=new URLSearchParams({api:'1',query:[label,location].filter(Boolean).join(', ')});return 'https://www.google.com/maps/search/?'+params.toString()}
