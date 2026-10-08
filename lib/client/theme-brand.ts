import {BRAND_COOKIE, themeBrand} from '../theme-brand';

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
  // Reinsert the same manifest URL so fresh installation can read the chosen
  // palette. Preserve its location and app ID for existing installations.
  const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (manifest) {
    const replacement = manifest.cloneNode(false) as HTMLLinkElement;
    replacement.href = '/manifest.webmanifest';
    replacement.crossOrigin = 'use-credentials';
    manifest.replaceWith(replacement);
  }
}
