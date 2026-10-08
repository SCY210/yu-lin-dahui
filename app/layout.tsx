import type { Metadata, Viewport } from "next";
import {cookies} from "next/headers";
import {BRAND_COOKIE,themeBrand,brandMetadata} from "../lib/theme-brand";
import "./globals.css";
import "./decor-layout.css";
import "./wuxia-theme.css";
import AppRuntime from './app-runtime';
import './legal.css';
import {VisualThemeProvider,ThemeSwitcher} from './visual-theme';

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#5048dc',
};

const baseMetadata: Metadata = {
  title: "羽林大会 · 羽毛球友社区",
  description: "报名、候补、公平排场、比赛积分与透明费用分摊。",
  applicationName: '羽林大会',
  manifest: '/manifest.webmanifest',
  appleWebApp: {capable:true,title:'羽林大会',statusBarStyle:'default'},
  other: {'apple-mobile-web-app-capable':'yes'},

};

export async function generateMetadata():Promise<Metadata>{const choice=(await cookies()).get(BRAND_COOKIE)?.value;return {...baseMetadata,...brandMetadata(choice)}}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
 const brand=themeBrand((await cookies()).get(BRAND_COOKIE)?.value);
 return (
    <html lang="zh-CN" className={brand.theme+'-theme'} suppressHydrationWarning>
      <body className="antialiased"><VisualThemeProvider initialTheme={brand.theme}><div className="ui-theme-toolbar"><ThemeSwitcher/></div><AppRuntime/>{children}<footer className="legal-footer" aria-label="Legal information"><a href="/privacy">Privacy / 隐私说明</a><a href="/terms">Club rules / 使用规则</a></footer></VisualThemeProvider></body>
    </html>
  );
}
