import { ContractEditingView } from "@/views/contract-editing-view";
import { env } from "@/shared/config/env";

type Props = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function ContractEditPage({ params }: Props) {
  const { slug } = await params;

  return (
    <ContractEditingView slug={slug} botUsername={env.telegramBotUsername} />
  );
}
