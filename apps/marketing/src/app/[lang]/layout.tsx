import "@/app/globals.css";
import { Locale } from "@/utils/i18n-config";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Listen to the universe of sounds",
  description: "A media-streaming service",
  applicationName: "Astral",
  authors: { name: "Leytox" },
  keywords: ["music", "streaming", "media", "audio"],
  creator: "Leytox",
  publisher: "Leytox",
  openGraph: {
    title: "Listen to the universe of sounds",
    description: "A media-streaming service",
    siteName: "Astral",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Astral",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    title: "Listen to the universe of sounds",
    description: "A media-streaming service",
    creator: "@leytox",
    card: "summary_large_image",
    images: ["/og-image.png"],
  },
};

export default async function RootLayout(props: {
  children: React.ReactNode;
  params: Promise<{ lang: Locale }>;
}) {
  const params = await props.params;
  const { children } = props;
  return (
    <html lang={params.lang} className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
