import { Check } from "lucide-react";
import { useTranslations } from "next-intl";

import type { TelegramPostPreviewDto } from "../api/dto";

type Props = {
  preview: TelegramPostPreviewDto;
  selectedMediaRefs: string[];
  toggleImage: (imageUrl: string) => void;
  setPrimaryImage: (imageUrl: string) => void;
  selectedImagesCount: number;
  description: string;
  tone?: "default" | "accent";
};

export function ContractImagesPreview({
  preview,
  selectedMediaRefs,
  toggleImage,
  setPrimaryImage,
  selectedImagesCount,
  description,
  tone = "default",
}: Props) {
  const t = useTranslations("Contracts");

  return (
    <div className="mt-6 rounded-3xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-950">
            {t("PostImagesTitle")}
          </h3>
          <p className="mt-1 text-sm text-zinc-600">{description}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            tone === "accent" && selectedImagesCount > 0
              ? "bg-brand-accent/15 text-brand-accent-ink dark:text-brand-accent"
              : "bg-white text-zinc-700"
          }`}
        >
          {t("SelectedImagesCount", { count: selectedImagesCount })}
        </span>
      </div>

      {selectedImagesCount > 0 ? (
        <p className="mt-3 text-xs leading-5 text-zinc-500">
          {t("PrimaryImageHelper")}
        </p>
      ) : null}

      {preview.images.length > 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {preview.images.map((imageUrl) => {
            const selected = selectedMediaRefs.includes(imageUrl);
            const isPrimary = selectedMediaRefs[0] === imageUrl;

            return (
              <div
                key={imageUrl}
                className={`overflow-hidden rounded-3xl border text-left transition ${
                  selected
                    ? tone === "accent"
                      ? "border-brand-accent-ink ring-2 ring-brand-accent-ink/15 dark:border-brand-accent dark:ring-brand-accent/15"
                      : "border-zinc-950 ring-2 ring-zinc-950/10"
                    : "border-zinc-200 hover:border-zinc-400"
                }`}
              >
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleImage(imageUrl)}
                  className={`relative block w-full outline-none focus-visible:ring-2 focus-visible:ring-inset ${
                    tone === "accent"
                      ? "focus-visible:ring-brand-accent-ink dark:focus-visible:ring-brand-accent"
                      : "focus-visible:ring-zinc-950 dark:focus-visible:ring-white"
                  }`}
                >
                  <img
                    src={imageUrl}
                    alt={t("TelegramPostImageAlt")}
                    className="h-40 w-full object-cover"
                  />
                  {isPrimary ? (
                    <span
                      className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold shadow-lg ${
                        tone === "accent"
                          ? "bg-brand-accent text-black"
                          : "bg-zinc-950 text-white"
                      }`}
                    >
                      {t("PrimaryImageBadge")}
                    </span>
                  ) : null}
                  {selected && tone === "accent" ? (
                    <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-brand-accent text-black shadow-lg">
                      <Check className="h-4 w-4 stroke-[3]" aria-hidden="true" />
                    </span>
                  ) : null}
                </button>
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="truncate text-xs text-zinc-500">{imageUrl}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    {selected && !isPrimary ? (
                      <button
                        type="button"
                        onClick={() => setPrimaryImage(imageUrl)}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold outline-none transition focus-visible:ring-2 ${
                          tone === "accent"
                            ? "border-brand-accent-ink/30 text-brand-accent-ink hover:border-brand-accent-ink focus-visible:ring-brand-accent-ink dark:border-brand-accent/30 dark:text-brand-accent dark:hover:border-brand-accent dark:focus-visible:ring-brand-accent"
                            : "border-zinc-300 text-zinc-900 hover:border-zinc-950 focus-visible:ring-zinc-950"
                        }`}
                      >
                        {t("MakePrimaryImage")}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => toggleImage(imageUrl)}
                      className={`rounded-sm text-xs font-medium outline-none focus-visible:ring-2 ${
                        tone === "accent"
                          ? "text-brand-accent-ink focus-visible:ring-brand-accent-ink dark:text-brand-accent dark:focus-visible:ring-brand-accent"
                          : "text-zinc-900 focus-visible:ring-zinc-950"
                      }`}
                    >
                      {selected ? t("DeselectImage") : t("SelectImage")}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 text-sm text-zinc-500">
          {t("NoPostImages")}
        </p>
      )}
    </div>
  );
}
