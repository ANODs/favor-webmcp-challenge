import { Link } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";

import { routes } from "@/shared/config/routes";
import { type PortfolioCaseDto } from "../api/dto";
import { SurfaceCard } from "@/shared/ui/surface-card";
import { formatDateTime } from "@/shared/lib/format";
import { Trash2 } from "lucide-react";

type Props = {
  portfolioCase: PortfolioCaseDto;
  onDelete?: (id: number) => void;
  isDeleting?: boolean;
};

const getLinkLabel = (url: string, fallbackLabel?: string) => {
  if (fallbackLabel) {
    return fallbackLabel;
  }

  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

export function PortfolioCaseCard({ portfolioCase, onDelete, isDeleting }: Props) {
  const locale = useLocale();
  const t = useTranslations("Profile");

  return (
    <SurfaceCard className="relative overflow-hidden group">
      <div className="flex flex-col h-full">
        <div className="flex justify-between items-start gap-4">
          <h3 className="text-lg font-semibold text-zinc-950 wrap-break-word">
            {portfolioCase.title}
          </h3>
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(portfolioCase.id)}
              disabled={isDeleting}
              className="text-zinc-400 transition-colors hover:text-red-500 focus-visible:rounded-md focus-visible:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
              aria-label={t("DeleteCaseConfirm")}
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
        
        <p className="text-xs text-zinc-500 mt-1">
          {formatDateTime(
            portfolioCase.createdAt,
            locale === "en" ? "en-US" : "ru-RU",
          )}
        </p>

        {portfolioCase.description && (
          <p className="mt-3 text-sm text-zinc-600 whitespace-pre-wrap wrap-break-word">
            {portfolioCase.description}
          </p>
        )}

        {portfolioCase.links && portfolioCase.links.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase text-zinc-500">
              {t("PortfolioLinks")}
            </p>
            <div className="flex flex-wrap gap-2">
              {portfolioCase.links.map((link, index) => (
                <a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200 transition"
                >
                  {getLinkLabel(link.url, link.label)}
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="mt-auto pt-4 flex flex-wrap gap-3">
          {portfolioCase.telegramPostUrl && (
            <a
              href={portfolioCase.telegramPostUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-blue-600 hover:text-blue-700 transition"
            >
              {t("OriginalPost")}
            </a>
          )}
          {portfolioCase.contract && (
            <Link
              href={routes.contractBySlug(portfolioCase.contract.slug)}
              className="text-sm font-medium text-zinc-700 hover:text-zinc-900 transition"
            >
              {t("PortfolioContract", {
                title:
                  (locale === "en"
                    ? portfolioCase.contract.titleEn || portfolioCase.contract.titleRu
                    : portfolioCase.contract.titleRu || portfolioCase.contract.titleEn) ||
                  t("PortfolioCaseFallback"),
              })}
            </Link>
          )}
        </div>
      </div>
    </SurfaceCard>
  );
}
