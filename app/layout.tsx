import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "羽林大会 · 私人羽毛球群",
  description: "报名、候补、公平排场、比赛积分与透明AA记账。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
