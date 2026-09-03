"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslations } from "next-intl";

import {
  canManageContract,
  contractQueryKeys,
  contractsClient,
} from "@/entities/contract";
import { authClient, sessionQueryKeys } from "@/entities/session";
import {
  clearEditContractDraft,
  EditContractForm,
} from "@/features/edit-contract";
import { useRouter } from "@/i18n/routing";
import { routes } from "@/shared/config/routes";
import {
  ActionCard,
  ActionCardButton,
  ConfirmationDialog,
  EmptyState,
  SurfaceCard,
} from "@/shared/ui";

export function ContractEditingView({ slug, botUsername }: Props) {
  const router = useRouter();
  const t = useTranslations("ContractEditing");
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false);
  const meQuery = useQuery({
    queryKey: sessionQueryKeys.currentUser,
    queryFn: authClient.getMe,
  });
  const contractQuery = useQuery({
    queryKey: contractQueryKeys.detail(slug),
    queryFn: () => contractsClient.getBySlug(slug),
  });
  const contract = contractQuery.data;

  const destroyMutation = useMutation({
    mutationFn: () => contractsClient.destroy(slug),
    onSuccess: () => {
      if (meQuery.data && contract) {
        clearEditContractDraft(meQuery.data.id, contract.id);
      }
      setIsDeleteConfirmationOpen(false);
      router.push(routes.feed);
    },
  });

  const canEdit = canManageContract(contract, meQuery.data);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6">
      {contractQuery.isLoading || meQuery.isLoading ? (
        <SurfaceCard>
          <p className="text-sm text-zinc-600">{t("Loading")}</p>
        </SurfaceCard>
      ) : null}

      {contractQuery.isError ? (
        <SurfaceCard>
          <p className="text-sm text-red-700">
            {t("LoadError")}
          </p>
        </SurfaceCard>
      ) : null}

      {contract && !canEdit ? (
        <SurfaceCard>
          <EmptyState
            title={t("UnavailableTitle")}
            description={t("UnavailableDescription")}
          />
        </SurfaceCard>
      ) : null}

      {contract && canEdit && meQuery.data ? (
        <EditContractForm
          contract={contract}
          botUsername={botUsername}
          draftOwnerId={meQuery.data.id}
        />
      ) : null}

      {contract && canEdit ? (
        <ActionCard
          title={t("DangerZoneTitle")}
          description={t("DangerZoneDescription")}
        >
          <ActionCardButton
            type="button"
            onClick={() => {
              destroyMutation.reset();
              setIsDeleteConfirmationOpen(true);
            }}
            disabled={destroyMutation.isPending}
            className="mt-auto !bg-red-50 text-red-700 hover:!bg-red-100"
          >
            {destroyMutation.isPending ? t("Deleting") : t("DeleteForever")}
          </ActionCardButton>
        </ActionCard>
      ) : null}

      <ConfirmationDialog
        isOpen={isDeleteConfirmationOpen}
        onClose={() => {
          setIsDeleteConfirmationOpen(false);
          destroyMutation.reset();
        }}
        onConfirm={() => destroyMutation.mutate()}
        description={t("DeleteConfirmation")}
        confirmLabel={t("DeleteConfirm")}
        pendingLabel={t("Deleting")}
        confirmVariant="danger"
        isPending={destroyMutation.isPending}
        errorMessage={
          destroyMutation.isError
            ? t("DeleteError")
            : undefined
        }
      />
    </main>
  );
}

type Props = {
  slug: string;
  botUsername: string;
};
