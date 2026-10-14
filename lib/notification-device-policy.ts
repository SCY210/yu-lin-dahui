/** Conservative browser-reported classification, not hardware attestation.
 * Unknown devices and tablets do not qualify for phone notification points. */
export function notificationDeviceIsPhone(headers:Pick<Headers,'get'>){
 const ua=headers.get('user-agent')??'';
 if(headers.get('sec-ch-ua-mobile')==='?0'||/iPad|iPod|Tablet|Windows NT|Macintosh|CrOS/i.test(ua))return false;
 return /iPhone/i.test(ua)||(/Android/i.test(ua)&&/Mobile/i.test(ua));
}
