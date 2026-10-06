import {readFileSync,writeFileSync} from 'node:fs';
// The artwork is bundled into the Worker so static hosting cannot bypass its account guard.
const lines=['// Generated private artwork; no public static asset route. See scripts/encode-aquarium-art.mjs.','export const aquariumArt = {'];
for(const kind of ['hero','mascot','friends','capyhug','capypaws','loopywalk'])lines.push(kind+':'+JSON.stringify(readFileSync('assets/private-aquarium/'+kind+'.webp').toString('base64'))+',');
lines.push('} as const;','');writeFileSync('lib/aquarium-art.ts',lines.join('\n'));
