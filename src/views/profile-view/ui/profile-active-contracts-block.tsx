"use client";

import { useTranslations } from "next-intl";

import type { ContractDto } from "@/entities/contract";
import type { UserDto } from "@/entities/user";
import { EmptyState, SurfaceCard } from "@/shared/ui";
import { ContractCard, ContractCardSkeleton } from "@/widgets/contract-feed";

type Props = {
  contracts: ContractDto[];
  isOwnProfile: boolean;
  viewer: Pick<UserDto, "id" | "role" | "telegramId"> | null;
  isViewerLoading: boolean;
  botUsername: string;
};

export function ProfileActiveContractsBlock({
  contracts,
  isOwnProfile,
  viewer,
  isViewerLoading,
  botUsername,
}: Props) {
  const t = useTranslations("Profile");

  if (!contracts.length) {
    return (
      <SurfaceCard className="rounded-[2rem]">
        <EmptyState
          title={t("NoActiveContractsTitle")}
          description={
            isOwnProfile
              ? t("NoActiveContractsOwn")
              : t("NoActiveContractsOther")
          }
        />
      </SurfaceCard>
    );
  }

  return (
    <div className="grid gap-4">
      {contracts.map((contract) => (
        <ContractCard
          key={contract.id}
          contract={contract}
          viewerId={viewer?.id ?? null}
          viewerRole={viewer?.role}
          viewerTelegramId={viewer?.telegramId}
          botUsername={isViewerLoading ? undefined : botUsername}
          isViewerLoading={isViewerLoading}
        />
      ))}
    </div>
  );
}

export function ProfileActiveContractsSkeleton() {
  return (
    <div className="grid gap-4" aria-hidden="true">
      <ContractCardSkeleton />
      <ContractCardSkeleton />
    </div>
  );
}
