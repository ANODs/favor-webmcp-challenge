import type { ContractTypeDto } from "@/entities/contract";

export type SearchFiltersState = {
  search: string;
  category: string;
  type: "" | ContractTypeDto;
  status: string;
  isEscrow: "" | "true" | "false";
  minPrice: string;
  maxPrice: string;
  minDeadline: string;
  maxDeadline: string;
  minRating: string;
  period: "" | "day" | "week" | "month";
  mineOnly: boolean;
  hideScouted: boolean;
  favoritesOnly: boolean;
  sortBy: "" | "price" | "deals";
  sortOrder: "asc" | "desc";
};
