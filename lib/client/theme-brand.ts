import {BRAND_COOKIE,BRAND_CHANGE_EVENT,brandManifestUrl,themeBrand} from '../theme-brand';

/** All links stay same-origin; this cookie stores only a device's icon palette. */
export function syncThemeBrand(document: Document, theme: string) {
  const brand = themeBrand(theme);
  document.cookie = `${BRAND_COOKIE}=${brand.theme}; Path=/; Max-Age=31536000; SameSite=Lax${document.location.protocol === 'https:' ? '; Secure' : ''}`;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', brand.color);
  for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]')) {
    link.href = brand.logo;
    link.type = 'image/svg+xml';
  }
  for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel="apple-touch-icon"]')) {
    link.href = brand.apple;
    link.sizes.value = '180x180';
  }
  // Put the palette in the URL: native install fetches may omit cookies.
  // The manifest's app ID and start URL remain unchanged.
  const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  const next=brandManifestUrl(brand.theme);
  if (manifest && manifest.getAttribute('href')!==next) {
    const replacement = manifest.cloneNode(false) as HTMLLinkElement;
    replacement.href = next;
    replacement.crossOrigin = 'use-credentials';
    manifest.replaceWith(replacement);
    const browser=document.defaultView;
    if(browser)browser.dispatchEvent(new Event(BRAND_CHANGE_EVENT));
  }
}
