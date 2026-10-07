import {BRAND_COOKIE, brandManifest} from '../../lib/theme-brand';
export const dynamic = 'force-dynamic';
export function GET(request: Request) {
  const cookie = request.headers.get('cookie') ?? '';
  const choice = cookie.split(';').map(value => value.trim()).find(value => value.startsWith(BRAND_COOKIE+'='))?.slice(BRAND_COOKIE.length+1);
  return new Response(JSON.stringify(brandManifest(choice)), {headers: {
    'Content-Type': 'application/manifest+json; charset=utf-8',
    'Cache-Control': 'private, no-store', 'Vary': 'Cookie',
  }});
}
