export const dynamic = 'force-dynamic';
import type { Metadata, Viewport } from "next";
import { Geist_Mono, Montserrat } from "next/font/google";
import Script from "next/script";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';

import "../globals.css";

import { AppProvider } from "@/app/providers/app-provider";
import { env } from "@/shared/config/env";
import { siteConfig } from "@/shared/config/site";
import { getDefaultOgImage, getOpenGraphLocale, getSiteBaseUrl } from "@/shared/lib/seo";
import { LiquidGlassDefs } from "@/shared/ui";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { getTranslations } from "next-intl/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  const imageUrl = getDefaultOgImage(locale);

  return {
    title: {
      template: t("titleTemplate"),
      default: t("defaultTitle"),
    },
    description: t("description"),
    openGraph: {
      title: t("defaultTitle"),
      description: t("description"),
      siteName: siteConfig.name,
      type: "website",
      locale: getOpenGraphLocale(locale),
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: t("defaultTitle"),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: t("defaultTitle"),
      description: t("description"),
      images: [imageUrl],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    applicationName: siteConfig.name,
    metadataBase: new URL(getSiteBaseUrl()),
    icons: {
      icon: [
        {
          media: '(prefers-color-scheme: light)',
          url: '/light.ico',
          href: '/light.ico',
        },
        {
          media: '(prefers-color-scheme: dark)',
          url: '/dark.ico',
          href: '/dark.ico',
        }
      ],
      apple: '/dark.ico',
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  setRequestLocale(locale);

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  const messages = await getMessages({ locale });

  // Telegram's beforeInteractive SDK mutates these root elements before React hydrates.
  return (
    <html
      lang={locale}
      className={`${montserrat.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full bg-zinc-50 text-zinc-950"
        data-telegram-bot-username={env.telegramBotUsername}
        suppressHydrationWarning
      >
        <LiquidGlassDefs />
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        <Script 
          src="https://sad.adsgram.ai/js/sad.min.js" 
          strategy="lazyOnload" 
        />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AppProvider
            tonManifestUrl={`${env.baseUrl}/tonconnect-manifest.json`}
            telegramBotUsername={env.telegramBotUsername}
          >
            {children}
          </AppProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
