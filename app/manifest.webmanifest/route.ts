import {requestBrand, brandManifest} from '../../lib/theme-brand';
export const dynamic = 'force-dynamic';
export function GET(request: Request) {
  return new Response(JSON.stringify(brandManifest(requestBrand(request))), {headers: {
    'Content-Type': 'application/manifest+json; charset=utf-8',
    'Cache-Control': 'private, no-store', 'Vary': 'Cookie',
  }});
}
