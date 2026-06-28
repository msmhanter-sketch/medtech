import type { Metadata, Viewport } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import ConditionalHeader from "@/components/ConditionalHeader";
import ConditionalFooter from "@/components/ConditionalFooter";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "MedServicePrice.kz — Сравнение цен на медицинские услуги",
  description:
    "Агрегатор цен на анализы, УЗИ и приёмы врачей в Казахстане. Данные с invitro.kz, helix.kz, doq.kz, kdlolymp.kz и др.",
  keywords: "медицинские услуги, цены клиник, МРТ Астана, анализы Алматы, сравнение цен",
  manifest: "/manifest.json",
  openGraph: {
    title: "MedServicePrice.kz",
    description: "Сравнение цен на медицинские услуги в Казахстане",
    type: "website",
    locale: "ru_KZ",
  },
};

export const viewport: Viewport = {
  themeColor: "#00d4c8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
      </head>
      <body>
        <Providers>
          <ConditionalHeader />
          <main className="relative min-h-[calc(100vh-80px)] overflow-x-hidden">
            {children}
          </main>
          <ConditionalFooter />
        </Providers>
      </body>
    </html>
  );
}
