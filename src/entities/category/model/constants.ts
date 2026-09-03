import {
  CATEGORY_CATALOG,
  getCategoryLabel,
  type CategoryId,
} from "./catalog";

export type CategoryItem = {
  id: CategoryId;
  labelRu: string;
  labelEn: string;
  count: number;
  myPromotion?: {
    id: number;
    endsAt: string;
    assignedContractId: number | null;
    source: "paid_auction" | "premium_free";
  } | null;
};

export const DEFAULT_CATEGORIES: CategoryId[] = CATEGORY_CATALOG.map(({ id }) => id);

export const getCategoryItemLabel = (
  category: Pick<CategoryItem, "id" | "labelRu" | "labelEn">,
  locale: string,
) =>
  getCategoryLabel(category.id, locale) ??
  (locale.toLowerCase().startsWith("en")
    ? category.labelEn || category.labelRu
    : category.labelRu || category.labelEn);

export {
  CATEGORY_CATALOG,
  CATEGORY_TAXONOMY_VERSION,
  assertValidCategoryCatalog,
  getCategoryAliases,
  getCategoryLabel,
  isCategoryId,
  normalizeCategoryAlias,
  normalizeCategoryKey,
  normalizeCategoryName,
  resolveCategoryId,
  validateCategoryCatalog,
} from "./catalog";

export type {
  CategoryCatalogIssue,
  CategoryDefinition,
  CategoryId,
  CategoryLabels,
  CategoryLocale,
} from "./catalog";
