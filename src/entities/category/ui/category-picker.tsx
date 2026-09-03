"use client";

import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { useCategories } from "../api/use-categories";
import {
  getCategoryItemLabel,
  resolveCategoryId,
  type CategoryItem,
} from "../model/constants";

type Props = {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  tone?: "default" | "accent";
};

export function CategoryPicker({
  value,
  onChange,
  error,
  tone = "default",
}: Props) {
  const locale = useLocale();
  const t = useTranslations("SearchFilter");
  const categoriesQuery = useCategories();
  const categories = useMemo(() => categoriesQuery.data || [], [categoriesQuery.data]);
  const [searchQuery, setSearchQuery] = useState("");
  const selectedCategoryId = resolveCategoryId(value);

  const filteredCategories = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase(locale);
    if (!query) return categories;

    return categories.filter((category) =>
      [category.labelRu, category.labelEn, category.id].some((candidate) =>
        candidate.toLocaleLowerCase(locale).includes(query),
      ),
    );
  }, [categories, locale, searchQuery]);

  const handleSelectCategory = (categoryId: string) => {
    onChange(selectedCategoryId === categoryId ? "" : categoryId);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={t("SearchTagsPlaceholder")}
          className={`w-full rounded-2xl border border-zinc-200 bg-white py-2.5 pl-10 pr-4 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-100 ${
            tone === "accent"
              ? "focus:border-brand-accent-ink focus:ring-2 focus:ring-brand-accent-ink/10 dark:focus:!border-brand-accent dark:focus:ring-brand-accent/15"
              : "focus:border-zinc-400 dark:focus:border-zinc-700"
          }`}
        />
      </div>

      <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {filteredCategories.map((category: CategoryItem) => {
          const isSelected = selectedCategoryId === category.id;
          const categoryLabel = getCategoryItemLabel(category, locale);

          return (
            <button
              key={category.id}
              type="button"
              ref={(node) => {
                if (isSelected && node) {
                  node.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
                }
              }}
              onClick={() => handleSelectCategory(category.id)}
              className={`group flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium outline-none transition-all focus-visible:ring-2 ${
                tone === "accent"
                  ? "focus-visible:ring-brand-accent-ink dark:focus-visible:ring-brand-accent"
                  : "focus-visible:ring-zinc-500"
              } ${
                isSelected
                  ? tone === "accent"
                    ? "bg-brand-accent text-black shadow-sm"
                    : "bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900"
                  : category.myPromotion
                    ? "border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800/70 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              <span
                className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border ${
                  isSelected
                    ? tone === "accent"
                      ? "border-black/15 bg-black text-brand-accent"
                      : "border-white bg-white text-zinc-900 dark:border-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
                    : "border-zinc-400 bg-transparent group-hover:border-zinc-600 dark:border-zinc-600"
                }`}
              >
                {isSelected ? <Check className="h-2.5 w-2.5 stroke-[3]" /> : null}
              </span>
              <span>
                {categoryLabel}
                {category.myPromotion ? t("PromotedSuffix") : ""}
              </span>
            </button>
          );
        })}
      </div>

      {error ? (
        <span className="text-xs font-medium text-red-600 dark:text-red-400">{error}</span>
      ) : null}
    </div>
  );
}
