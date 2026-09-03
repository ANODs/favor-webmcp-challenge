"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";

import {
  contractQueryKeys,
  contractsClient,
  type ContractListFilters,
} from "@/entities/contract";

export function useProfileActiveContractsQuery(
  authorId: number | null,
  activeContractsCount: number,
  enabled: boolean,
) {
  const locale = useLocale();
  const filters = {
    activeAuthorId: authorId ?? undefined,
  } satisfies ContractListFilters;

  return useInfiniteQuery({
    queryKey: contractQueryKeys.activeAuthorList(
      authorId,
      activeContractsCount,
      locale,
    ),
    queryFn: ({ pageParam }) => contractsClient.getList(filters, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(authorId && enabled),
  });
}
