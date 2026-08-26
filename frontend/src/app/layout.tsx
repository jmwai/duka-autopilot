import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import { AppProviders } from "@/components/app-providers";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Duka Autopilot",
    template: "%s · Duka Autopilot",
  },
  description: "The autonomous night shift for an independent Kenyan shop.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
