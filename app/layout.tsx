import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./decor-layout.css";
import AppRuntime from './app-runtime';

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#4f46e5',
};

export const metadata: Metadata = {
  title: "羽林大会 · 羽毛球友社区",
  description: "报名、候补、公平排场、比赛积分与透明费用分摊。",
  applicationName: '羽林大会',
  manifest: '/manifest.webmanifest',
  appleWebApp: {capable:true,title:'羽林大会',statusBarStyle:'default'},
  other: {'apple-mobile-web-app-capable':'yes'},
  icons: {
    icon: "/favicon.svg?v=feather-v2",
    shortcut: "/favicon.svg?v=feather-v2",
    apple: '/icons/apple-touch-icon-feather.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased"><AppRuntime/>{children}</body>
    </html>
  );
}
