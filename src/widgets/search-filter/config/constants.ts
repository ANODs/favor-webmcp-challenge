import { dealStatusMeta } from "@/entities/deal";
import type { SearchFiltersState } from "../lib/types";

type Translate = (key: string) => string;

export const getTypeOptions = (t: Translate): Array<{ value: SearchFiltersState["type"]; label: string }> => [
  { value: "", label: t("AllTypes") },
  { value: "offer", label: "Offer" },
  { value: "order", label: "Order" },
];

export const getIsEscrowOptions = (t: Translate): Array<{ value: SearchFiltersState["isEscrow"]; label: string }> => [
  { value: "", label: t("AllDealTypes") },
  { value: "true", label: t("DealTypeEscrow") },
  { value: "false", label: t("DealTypeDirect") },
];

export const getSortOptions = (t: Translate): Array<{ value: SearchFiltersState["sortBy"]; label: string }> => [
  { value: "", label: t("SortDefault") },
  { value: "price", label: t("SortByPrice") },
  { value: "deals", label: t("SortByDealsCount") },
];

export const getPeriodOptions = (t: Translate): Array<{ value: SearchFiltersState["period"]; label: string }> => [
  { value: "", label: t("PeriodAllTime") },
  { value: "day", label: t("PeriodDay") },
  { value: "week", label: t("PeriodWeek") },
  { value: "month", label: t("PeriodMonth") },
];

export const getStatusOptions = (
  t: Translate,
  isModerator: boolean,
  forDeals: boolean = false
): Array<{ value: string; label: string }> => {
  if (forDeals) {
    return [
      { value: "", label: t("AllStatuses") },
      ...Object.keys(dealStatusMeta).map((value) => ({
        value,
        label: t(`status_${value}`),
      })),
    ];
  }

  return [
    { value: "", label: isModerator ? t("AllStatuses") : t("ActiveStatuses") },
    ...(isModerator
      ? [{ value: "active" as const, label: t("status_active") }]
      : []),
    ...(isModerator
      ? [
          {
            value: "pending_moderation" as const,
            label: t("status_pending_moderation"),
          },
          { value: "limit_reached" as const, label: t("status_limit_reached") },
          { value: "rejected" as const, label: t("status_rejected") },
        ]
      : []),
    { value: "archived", label: t("status_archived") },
  ];
};
