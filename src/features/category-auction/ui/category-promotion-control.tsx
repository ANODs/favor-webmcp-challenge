"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Crown } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";

import {
  CATEGORIES_QUERY_KEY,
  getCategoryLabel,
  resolveCategoryId,
  useCategories,
} from "@/entities/category";
import { SurfaceCard } from "@/shared/ui";
import { categoryAuctionClient } from "../api/client";

type Props = {
  contractId: number;
  categoryName: string;
  isActive: boolean;
};

export function CategoryPromotionControl({ contractId, categoryName, isActive }: Props) {
  const locale = useLocale();
  const format = useFormatter();
  const t = useTranslations("CategoryAuction");
  const queryClient = useQueryClient();
  const categoriesQuery = useCategories();
  const categoryId = resolveCategoryId(categoryName);
  const categoryLabel = getCategoryLabel(categoryId, locale) ?? categoryName;
  const category = categoriesQuery.data?.find((item) => item.id === categoryId);
  const promotion = category?.myPromotion;
  const mutation = useMutation({
    mutationFn: () => categoryAuctionClient.assignPromotion(promotion!.id, contractId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY }),
  });

  if (!promotion) return null;
  const isAssigned = promotion.assignedContractId === contractId;

  return (
    <SurfaceCard className="border-amber-200 bg-amber-50/70">
      <div className="flex items-center gap-2 text-amber-800">
        <Crown className="h-5 w-5" />
        <h2 className="font-semibold">
          {t("promotionTitle", { category: categoryLabel })}
        </h2>
      </div>
      <p className="mt-2 text-sm text-zinc-600">
        {t("promotionUntil", {
          date: format.dateTime(new Date(promotion.endsAt), {
            dateStyle: "medium",
            timeStyle: "short",
          }),
        })}
      </p>
      {isAssigned ? (
        <p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-amber-800">
          {t("promotionAssigned")}
        </p>
      ) : (
        <button
          type="button"
          disabled={!isActive || mutation.isPending}
          onClick={() => mutation.mutate()}
          className="mt-3 w-full rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-zinc-950 disabled:opacity-50"
        >
          {isActive ? t("pinContract") : t("publishContractFirst")}
        </button>
      )}
      {mutation.isError ? (
        <p className="mt-2 text-sm text-red-700">
          {t("changeContractError")}
        </p>
      ) : null}
    </SurfaceCard>
  );
}
