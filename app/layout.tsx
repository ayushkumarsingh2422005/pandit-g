import type { Metadata } from "next";
import { Geist, Noto_Sans_Devanagari } from "next/font/google";
import { LanguageProvider } from "./i18n/LanguageProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const notoDevanagari = Noto_Sans_Devanagari({
  variable: "--font-devanagari",
  subsets: ["devanagari"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Pandit G — Personal Vedic Astrology Guidance",
  description:
    "Speak directly with Pandit G ji on WhatsApp for personal Vedic astrology guidance. A real astrologer behind every reply. ₹151 per 3 min, 30-minute session.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${notoDevanagari.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
