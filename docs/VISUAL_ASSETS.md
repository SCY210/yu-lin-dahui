# Visual assets and provenance

The app uses indigo/purple controls, dark text, and soft neutral backgrounds. Decorative elements do not receive pointer interaction and have empty alt text when they add no information.

## Files and compression

| Asset | Source fixture | Deployed WebP |
|---|---|---|
| Crossed rackets | tests/fixtures/crossed-rackets.png; 1312 x 1199; 1,175,607 bytes | public/crossed-rackets.webp; 360 x 329; 50,536 bytes |
| Shuttlecock | tests/fixtures/shuttlecock.png; 1309 x 1202; 1,051,507 bytes | public/shuttlecock.webp; 512 x 470; 36,866 bytes |

Combined decoration size fell from 2,227,114 to 87,402 bytes (96.08%). Deterministic Lanczos resizing and Pillow WebP encoding (quality=90, method=6, exact=True) preserved the designs and transparency. Source PNGs remain image-test fixtures, not deployed public originals.

The racket's maximum CSS width is 116px and the shuttlecock's 170px; their WebP sources support roughly three times that density. Alpha was compared to resized sources during the original optimization. Recheck actual rendering after asset changes.

## Original generation instructions

Both original decorations were generated with the built-in image generator. Generation provenance does not itself establish exclusive copyright or guarantee third-party clearance. Keep source licenses for vendored assets and review any replacement asset's rights.

Shuttlecock prompt:

> Use case: stylized-concept. Asset type: small homepage and login decoration for a polished badminton club web app named Yu Lin Da Hui. Primary request: exactly one elegant floating badminton shuttlecock, isolated on a transparent background. White layered feather skirt, subtly textured ivory cork, thin indigo-violet collar. Restrained premium 3D studio illustration. Entire shuttlecock visible with ample transparent margin; diagonal motion, feather skirt upper left and cork lower right. Soft cool studio lighting. White/ivory with an indigo-purple collar only. Actual transparent PNG alpha; no text, background, frame, other objects, green, watermark, or outside cast shadow.

Crossed-rackets prompt:

> Use case: stylized-concept. Asset type: small decorative PNG for the same badminton club app, matching the white/ivory shuttlecock with indigo-violet collar. Exactly two full badminton rackets crossed at the shafts, isolated on transparent background. Light silver/ivory oval rims, restrained indigo string mesh, dark-indigo shafts, ivory wrapped grips. Premium 3D studio illustration; complete grips/heads within the frame and readable at about 140px. Soft cool studio lighting. Actual PNG alpha; no shuttlecock, text, logos, green, background, court, border, frame, watermark, or outside cast shadow.

Generated screenshots, individual author/task history, and tool-session notes are not shared application requirements. Verify narrow-screen overflow, contrast, focus, and the visual details of compressed assets when modifying them.

## Third-party notices

Preserve build/sites-vite-plugin.LICENSE and vendor/shadcn-tailwind-4.13.0.LICENSE.md. Existing dependency licenses continue to apply. No repository-wide license grant is inferred from those notices.
