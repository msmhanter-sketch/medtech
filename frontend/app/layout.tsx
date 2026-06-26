import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import NavHeader from "@/components/NavHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "MedPrice KZ — Сравнение цен на медицинские услуги",
  description:
    "Найдите лучшую цену на МРТ, анализы, УЗИ и приём врача в клиниках Астаны и Алматы. Сравните цены за секунды.",
  keywords: "медицинские услуги, цены клиник, МРТ Астана, анализы Алматы, сравнение цен",
  openGraph: {
    title: "MedPrice KZ",
    description: "Сравнение цен на медицинские услуги в Казахстане",
    type: "website",
    locale: "ru_KZ",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <NavHeader />
        <main>{children}</main>

        <Footer />
      </body>
    </html>
  );
}
