import categoryCatalogData from "./catalog.data.json";

export type CategoryLocale = "ru" | "en";

export const CATEGORY_TAXONOMY_VERSION = 3 as const;

export type CategoryLabels = Readonly<Record<CategoryLocale, string>>;

export type CategoryDefinition = Readonly<{
  id: string;
  labels: CategoryLabels;
  aliases: readonly string[];
}>;

type CategoryCatalogData = typeof categoryCatalogData;

export type CategoryId = keyof CategoryCatalogData;

type CategoryCatalogEntry = Readonly<
  CategoryDefinition & {
    id: CategoryId;
  }
>;

/**
 * Stable category IDs are persisted; localized labels are presentation only.
 * Aliases cover legacy values and common wording used in imported vacancies.
 */
export const CATEGORY_CATALOG: readonly CategoryCatalogEntry[] = Object.entries(
  categoryCatalogData,
).map(([id, definition]) => ({
  id: id as CategoryId,
  labels: definition.labels,
  aliases: definition.aliases,
}));

export type CategoryCatalogIssue = Readonly<{
  kind: "duplicate_id" | "missing_label" | "alias_collision";
  value: string;
  categoryIds: readonly string[];
}>;

export const normalizeCategoryName = (value: string) =>
  value.normalize("NFKC").trim().replace(/\s+/g, " ");

export const normalizeCategoryAlias = (value: string) =>
  normalizeCategoryName(value)
    .toLocaleLowerCase("ru-RU")
    .replace(/\u0451/g, "\u0435")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");

const rawAliases = (entry: CategoryDefinition) => [
  entry.id,
  entry.labels.ru,
  entry.labels.en,
  ...entry.aliases,
];

export function validateCategoryCatalog(
  catalog: readonly CategoryDefinition[] = CATEGORY_CATALOG,
): CategoryCatalogIssue[] {
  const issues: CategoryCatalogIssue[] = [];
  const ids = new Map<string, string[]>();
  const aliases = new Map<string, Set<string>>();

  for (const entry of catalog) {
    const duplicateIds = ids.get(entry.id) ?? [];
    duplicateIds.push(entry.id);
    ids.set(entry.id, duplicateIds);

    for (const locale of ["ru", "en"] as const) {
      if (!normalizeCategoryName(entry.labels[locale])) {
        issues.push({
          kind: "missing_label",
          value: locale,
          categoryIds: [entry.id],
        });
      }
    }

    for (const alias of rawAliases(entry)) {
      const normalized = normalizeCategoryAlias(alias);
      if (!normalized) continue;
      const owners = aliases.get(normalized) ?? new Set<string>();
      owners.add(entry.id);
      aliases.set(normalized, owners);
    }
  }

  for (const [id, occurrences] of ids) {
    if (occurrences.length > 1) {
      issues.push({ kind: "duplicate_id", value: id, categoryIds: [id] });
    }
  }

  for (const [alias, owners] of aliases) {
    if (owners.size > 1) {
      issues.push({
        kind: "alias_collision",
        value: alias,
        categoryIds: [...owners].sort(),
      });
    }
  }

  return issues;
}

export function assertValidCategoryCatalog(
  catalog: readonly CategoryDefinition[] = CATEGORY_CATALOG,
): void {
  const issues = validateCategoryCatalog(catalog);
  if (issues.length === 0) return;

  const details = issues
    .map((issue) => `${issue.kind}:${issue.value}:${issue.categoryIds.join(",")}`)
    .join("; ");
  throw new Error(`Invalid category catalog: ${details}`);
}

assertValidCategoryCatalog();

const catalogById = new Map<CategoryId, (typeof CATEGORY_CATALOG)[number]>(
  CATEGORY_CATALOG.map((entry) => [entry.id, entry]),
);

const idByAlias = new Map<string, CategoryId>();
for (const entry of CATEGORY_CATALOG) {
  for (const alias of rawAliases(entry)) {
    idByAlias.set(normalizeCategoryAlias(alias), entry.id);
  }
}

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === "string" && catalogById.has(value as CategoryId);
}

export function resolveCategoryId(
  value: string | null | undefined,
): CategoryId | null {
  if (!value) return null;
  if (isCategoryId(value)) return value;
  return idByAlias.get(normalizeCategoryAlias(value)) ?? null;
}

export function getCategoryLabel(
  value: string | null | undefined,
  locale: string,
): string | null {
  const id = resolveCategoryId(value);
  if (!id) return null;
  return (
    catalogById.get(id)?.labels[
      locale.toLowerCase().startsWith("en") ? "en" : "ru"
    ] ?? null
  );
}

export function getCategoryAliases(id: CategoryId): readonly string[] {
  const entry = catalogById.get(id);
  return entry ? rawAliases(entry) : [];
}

export function normalizeCategoryKey(value: string): string {
  return resolveCategoryId(value) ?? normalizeCategoryAlias(value);
}
