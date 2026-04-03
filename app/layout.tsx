import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Outfit } from "next/font/google";
import "../styles/globals.css";
import { PwaServiceWorkerRegistration } from "@/components/pwa/pwa-service-worker-registration";
import { siteConfig } from "@/lib/site";

const display = Outfit({
  variable: "--font-display",
  subsets: ["latin"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://convertilabs.com"),
  applicationName: siteConfig.name,
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: siteConfig.name,
  },
  icons: {
    apple: [
      {
        url: "/pwa/apple-touch-icon.png",
        sizes: "180x180",
      },
    ],
    icon: [
      {
        url: "/pwa/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/pwa/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        url: "/pwa/maskable-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1c2230",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${display.variable} ${mono.variable} antialiased`}>
        {children}
        <PwaServiceWorkerRegistration />
      </body>
    </html>
  );
}
