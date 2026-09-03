import { setRequestLocale } from "next-intl/server";
import { env } from "@/shared/config/env";
import { DealDetailsView } from "@/views/deal-details-view";

type Props = {
  params: Promise<{
    id: string;
    locale: string;
  }>;
};

export default async function DealDetailsPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  return <DealDetailsView id={Number(id)} botUsername={env.telegramBotUsername} />;
}
