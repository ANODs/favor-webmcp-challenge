import type { Metadata } from "next";
import { PrivacyView } from "@/views/privacy-view";
import { routes } from "@/shared/config/routes";
import { createWebsiteMetadata } from "@/shared/lib/seo";
import { getTranslations } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Privacy" });
  const metadata = await getTranslations({ locale, namespace: "Metadata" });

  return createWebsiteMetadata({
    locale,
    pathname: routes.privacy,
    title: t("title"),
    description: metadata("description"),
  });
}

export default function PrivacyPage() {
  return <PrivacyView />;
}
