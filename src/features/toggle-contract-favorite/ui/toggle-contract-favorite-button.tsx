"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import {
  contractQueryKeys,
  contractsClient,
  type ContractDto,
} from "@/entities/contract";
import { triggerTelegramImpact, triggerTelegramNotification } from "@/shared/lib/telegram";
import { HeartIcon } from "@/shared/ui";

type Props = {
  contract: Pick<ContractDto, "slug" | "isFavorite">;
  isAuthenticated: boolean;
  isAuthenticationPending?: boolean;
  onAuthRequired?: () => void;
};

const updateFavoriteState = (
  value: unknown,
  slug: string,
  isFavorite: boolean,
): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) =>
      item && typeof item === "object" && "slug" in item && item.slug === slug
        ? { ...item, isFavorite }
        : item,
    );
  }

  if (value && typeof value === "object" && "pages" in value && Array.isArray(value.pages)) {
    return {
      ...value,
      pages: value.pages.map((page) => updateFavoriteState(page, slug, isFavorite)),
    };
  }

  if (value && typeof value === "object" && "items" in value && Array.isArray(value.items)) {
    return {
      ...value,
      items: value.items.map((item) => updateFavoriteState(item, slug, isFavorite)),
    };
  }

  if (value && typeof value === "object" && "slug" in value && value.slug === slug) {
    return { ...value, isFavorite };
  }

  return value;
};

export function ToggleContractFavoriteButton({
  contract,
  isAuthenticated,
  isAuthenticationPending = false,
  onAuthRequired,
}: Props) {
  const t = useTranslations("Contracts");
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (isFavorite: boolean) =>
      contractsClient.setFavorite(contract.slug, isFavorite),
    onMutate: async (isFavorite) => {
      triggerTelegramImpact("light");
      await queryClient.cancelQueries({ queryKey: contractQueryKeys.all });
      const snapshots = queryClient.getQueriesData({ queryKey: contractQueryKeys.all });

      queryClient.setQueriesData(
        { queryKey: contractQueryKeys.all },
        (current) => updateFavoriteState(current, contract.slug, isFavorite),
      );

      return { snapshots };
    },
    onError: (_error, _isFavorite, context) => {
      for (const [queryKey, data] of context?.snapshots ?? []) {
        queryClient.setQueryData(queryKey, data);
      }
      triggerTelegramNotification("error");
    },
    onSuccess: ({ isFavorite }) => {
      triggerTelegramNotification("success");
      queryClient.setQueriesData(
        { queryKey: contractQueryKeys.all },
        (current) => updateFavoriteState(current, contract.slug, isFavorite),
      );
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: contractQueryKeys.all });
      await queryClient.invalidateQueries({
        queryKey: contractQueryKeys.detail(contract.slug),
      });
    },
  });

  const isFavorite = mutation.isPending
    ? Boolean(mutation.variables)
    : Boolean(contract.isFavorite);
  const label = isFavorite ? t("RemoveFromFavorites") : t("AddToFavorites");

  const handleClick = () => {
    if (isAuthenticationPending) {
      return;
    }

    if (!isAuthenticated) {
      onAuthRequired?.();
      return;
    }

    mutation.mutate(!isFavorite);
  };

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={isFavorite}
      title={label}
      disabled={mutation.isPending || isAuthenticationPending}
      onClick={handleClick}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white shadow-lg backdrop-blur-md transition hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 disabled:cursor-wait disabled:opacity-70 ${
        isFavorite ? "text-[#0f8c5c] dark:text-brand-accent" : ""
      }`}
    >
      <HeartIcon className="h-5 w-5" filled={isFavorite} />
    </button>
  );
}
