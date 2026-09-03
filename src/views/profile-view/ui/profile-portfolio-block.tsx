"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import type { PortfolioCaseDto } from "@/entities/portfolio-case";
import { PortfolioCaseCard } from "@/entities/portfolio-case";
import { CreatePortfolioCaseForm } from "@/features/create-portfolio-case";
import { ActionCard, ActionCardButton, ActionCardInset } from "@/shared/ui/action-card";

type Props = {
  isOwnProfile: boolean;
  isCreatingCase: boolean;
  portfolioCases: PortfolioCaseDto[];
  deletingCaseId?: number;
  isDeletingCase: boolean;
  onStartCreating: () => void;
  onCancelCreating: () => void;
  onCreated: () => void;
  onDelete?: (id: number) => void;
};

export function ProfilePortfolioBlock({
  isOwnProfile,
  isCreatingCase,
  portfolioCases,
  deletingCaseId,
  isDeletingCase,
  onStartCreating,
  onCancelCreating,
  onCreated,
  onDelete,
}: Props) {
  const t = useTranslations("Profile");

  return (
    <ActionCard title={t("PortfolioTitle")}>
      {isCreatingCase ? (
        <CreatePortfolioCaseForm
          onSuccess={onCreated}
          onCancel={onCancelCreating}
        />
      ) : portfolioCases.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {portfolioCases.map((portfolioCase) => (
            <PortfolioCaseCard
              key={portfolioCase.id}
              portfolioCase={portfolioCase}
              onDelete={onDelete}
              isDeleting={isDeletingCase && deletingCaseId === portfolioCase.id}
            />
          ))}
        </div>
      ) : (
        <ActionCardInset>
          {isOwnProfile
            ? t("NoPortfolioOwn")
            : t("NoPortfolioOther")}
        </ActionCardInset>
      )}

      {isOwnProfile && !isCreatingCase ? (
        <ActionCardButton
          type="button"
          onClick={onStartCreating}
          className="mt-4"
        >
          <Plus className="-ml-1 mr-2 h-4 w-4" />
          {t("AddCase")}
        </ActionCardButton>
      ) : null}
    </ActionCard>
  );
}
