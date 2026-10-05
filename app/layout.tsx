import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./decor-layout.css";
import "./wuxia-theme.css";
import AppRuntime from './app-runtime';
import {VisualThemeProvider,ThemeSwitcher} from './visual-theme';

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#202921',
};

export const metadata: Metadata = {
  title: "羽林大会 · 羽毛球友社区",
  description: "报名、候补、公平排场、比赛积分与透明费用分摊。",
  applicationName: '羽林大会',
  manifest: '/manifest.webmanifest',
  appleWebApp: {capable:true,title:'羽林大会',statusBarStyle:'default'},
  other: {'apple-mobile-web-app-capable':'yes'},
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: '/icons/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="wuxia-theme" suppressHydrationWarning>
      <body className="antialiased"><VisualThemeProvider><div className="ui-theme-toolbar"><ThemeSwitcher/></div><AppRuntime/>{children}</VisualThemeProvider></body>
    </html>
  );
}
