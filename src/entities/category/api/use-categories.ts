import { useQuery } from "@tanstack/react-query";

import type { CategoryItem } from "../model/constants";

export const CATEGORIES_QUERY_KEY = ["categories"] as const;

async function fetchCategories(): Promise<CategoryItem[]> {
  const response = await fetch("/api/categories");
  if (!response.ok) {
    throw new Error("Failed to fetch categories");
  }
  const json = (await response.json()) as { ok: boolean; data?: { categories: CategoryItem[] } };
  return json.data?.categories || [];
}

export function useCategories() {
  return useQuery({
    queryKey: CATEGORIES_QUERY_KEY,
    queryFn: fetchCategories,
    staleTime: 5 * 60 * 1000,
  });
}
