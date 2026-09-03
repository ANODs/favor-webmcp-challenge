import type { DealDto } from "@/entities/deal";
import { routes } from "@/shared/config/routes";
import { ActionCard, ActionCardLink, DownloadIcon, EmptyState } from "@/shared/ui";
import { ExternalLink, Link2 } from "lucide-react";
import { useTranslations } from "next-intl";

type Props = {
  deal: DealDto;
  isCustomer: boolean;
  notificationsBotUrl: string;
};

export function DealCommunicationBlock({
  deal,
  isCustomer,
  notificationsBotUrl,
}: Props) {
  const t = useTranslations("DealDetails");
  return (
    <div className="grid gap-4">
      <ActionCard
        title={t("contact_counterpart")}
        description={t("communication_desc")}
        className="rounded-[2rem] shadow-none"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {deal.contract?.slug ? (
            <ActionCardLink href={routes.contractBySlug(deal.contract.slug)} tone="secondary">
              {t("open_contract")}
            </ActionCardLink>
          ) : null}
          <ActionCardLink
            href={notificationsBotUrl}
            target="_blank"
            rel="noreferrer"
            tone="secondary"
          >
            {t("open_bot_notifications")}
          </ActionCardLink>
        </div>
      </ActionCard>

      <ActionCard
        title={t("project_files")}
        description={t("project_files_desc")}
        className="rounded-[2rem] shadow-none"
      >
        <div className="grid gap-4">
          {deal.briefResources.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-white/12 sm:p-5">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-zinc-500" aria-hidden="true" />
                <h4 className="text-sm font-bold text-zinc-950">
                  {t("project_source_materials")}
                </h4>
              </div>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                {t("project_source_materials_desc")}
              </p>
              <div className="mt-3 grid gap-2">
                {deal.briefResources.map((resource) => (
                  <a
                    key={resource.url}
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm font-semibold text-zinc-900 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-white/12 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                  >
                    <span className="min-w-0">
                      <span className="block truncate">
                        {resource.label || getResourceHost(resource.url)}
                      </span>
                      <span className="mt-0.5 block truncate text-xs font-normal text-zinc-500">
                        {resource.url}
                      </span>
                    </span>
                    <ExternalLink
                      className="h-4 w-4 shrink-0 text-zinc-400"
                      aria-hidden="true"
                    />
                  </a>
                ))}
              </div>
            </div>
          ) : null}

          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-white/12 sm:p-5">
            <h4 className="text-sm font-bold text-zinc-950">
              {t("portfolio_result")}
            </h4>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              {isCustomer
                ? t("portfolio_result_desc")
                : t("freelancer_upload_desc")}
            </p>
            <div className="mt-3">
          {deal.resultData || deal.resultFileId ? (
            <div className="grid gap-3">
                {deal.resultData ? (
                  <div>
                    <span className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">
                      {t("text_link")}
                    </span>
                    <p className="break-words whitespace-pre-wrap text-sm font-medium leading-6 text-zinc-900">
                      {deal.resultData}
                    </p>
                  </div>
                ) : null}

                {deal.resultFileId ? (
                  <div className={deal.resultData ? "border-t border-zinc-200 pt-3 dark:border-white/12" : ""}>
                    <span className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                      {t("attached_file")}
                    </span>
                    <a
                      href={`/api/deals/${deal.id}/result`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-transparent px-4 py-2.5 text-sm font-bold text-zinc-900 transition hover:bg-zinc-100 dark:border-white/12"
                    >
                      <DownloadIcon className="h-4 w-4" />
                      {t("download_file")}
                    </a>
                  </div>
                ) : null}
              </div>
            ) : (
              <EmptyState
                title={t("result_not_uploaded")}
                description={
                  isCustomer
                    ? t("result_not_uploaded_desc")
                    : t("freelancer_upload_cmd", { id: deal.id })
                }
              />
            )}
            </div>
          </div>
        </div>
      </ActionCard>
    </div>
  );
}

const getResourceHost = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};
