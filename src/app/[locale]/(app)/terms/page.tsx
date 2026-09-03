import type { Metadata } from "next";
import { TermsView } from "@/views/terms-view";
import { routes } from "@/shared/config/routes";
import { createWebsiteMetadata } from "@/shared/lib/seo";
import { getTranslations } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Terms" });
  const metadata = await getTranslations({ locale, namespace: "Metadata" });

  return createWebsiteMetadata({
    locale,
    pathname: routes.terms,
    title: t("title"),
    description: metadata("description"),
  });
}

export default function TermsPage() {
  return <TermsView />;
}
