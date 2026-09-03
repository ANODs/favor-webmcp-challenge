import { CreateContractForm } from "@/features/create-contract";

export function ContractPublicationView({
  publicationDraftToken,
  botUsername,
}: {
  publicationDraftToken?: string;
  botUsername: string;
}) {
  return (
    <main className="-mb-20 h-dvh w-full overflow-hidden lg:mb-0">
      <CreateContractForm
        publicationDraftToken={publicationDraftToken}
        botUsername={botUsername}
      />
    </main>
  );
}
