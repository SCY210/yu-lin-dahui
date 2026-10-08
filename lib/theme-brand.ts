export const BRAND_THEMES = ['classic', 'wuxia'] as const;
export type BrandTheme = typeof BRAND_THEMES[number];
export const BRAND_COOKIE = 'yulin_icon_theme';
export function brandTheme(value: unknown): BrandTheme {
  return value === 'wuxia' ? value : 'classic';
}
export function themeBrand(value: unknown) {
  const theme = brandTheme(value);
  return {
    theme,
    color: {classic: '#5048dc', wuxia: '#32283f'}[theme],
    background: {classic: '#f5f6fa', wuxia: '#f4eddf'}[theme],
    logo: `/brand/${theme}-v4.svg`,
    apple: `/icons/${theme}-apple-v4.png`,
    icon192: `/icons/${theme}-192-v4.png`,
    icon512: `/icons/${theme}-512-v4.png`,
    maskable: `/icons/${theme}-maskable-v4.png`,
  };
}
export function brandManifest(value: unknown) {
  const brand = themeBrand(value);
  return {
    id: '/', name: '羽林大会', short_name: '羽林大会',
    description: '羽毛球活动报名、比赛、积分与费用分摊。', lang: 'zh-CN',
    start_url: '/', scope: '/', display: 'standalone',
    background_color: brand.background, theme_color: brand.color,
    icons: [
      {src: brand.icon192, sizes: '192x192', type: 'image/png', purpose: 'any'},
      {src: brand.icon512, sizes: '512x512', type: 'image/png', purpose: 'any'},
      {src: brand.maskable, sizes: '512x512', type: 'image/png', purpose: 'maskable'},
    ],
  };
}
