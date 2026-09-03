import { ContractPublicationView } from "@/views/contract-publication-view";
import { env } from "@/shared/config/env";
import {
  CONTRACT_PUBLICATION_DRAFT_QUERY_PARAM,
  isContractPublicationDraftToken,
} from "@/shared/lib/telegram";

export default async function CreateContractPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const rawDraftToken =
    resolvedSearchParams[CONTRACT_PUBLICATION_DRAFT_QUERY_PARAM];
  const publicationDraftToken =
    typeof rawDraftToken === "string" &&
    isContractPublicationDraftToken(rawDraftToken)
      ? rawDraftToken
      : undefined;

  return (
    <ContractPublicationView
      publicationDraftToken={publicationDraftToken}
      botUsername={env.telegramBotUsername}
    />
  );
}
