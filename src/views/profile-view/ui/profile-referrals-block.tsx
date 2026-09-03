"use client";

import type { ComponentProps } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

import { CONTRACT_REFERRAL_REWARD_SHARE_PERCENT } from "@/features/contract-referrals";
import { buildReferralShareText } from "@/features/share-referral";
import { TelegramStoryShareButton } from "@/features/share-telegram-story";
import { routes } from "@/shared/config/routes";
import {
  buildReferralStartParam,
  buildTelegramMiniAppUrl,
  triggerTelegramImpact,
} from "@/shared/lib/telegram";
import { formatDateTime } from "@/shared/lib/format";
import { getEscrowCurrencyDisplayName } from "@/shared/lib/ton";
import { ActionCard, ActionCardInset } from "@/shared/ui/action-card";
import type {
  ProfileContractReferralDto,
  ProfileContractReferralStatsDto,
  ProfileReferralDto,
} from "@/entities/user";

import { ProfileInfiniteScroll } from "./profile-infinite-scroll";

type PaginationProps = ComponentProps<typeof ProfileInfiniteScroll>;

type Props = {
  botUsername: string;
  telegramId?: number | string | null;
  referrals: ProfileReferralDto[];
  contractReferrals: ProfileContractReferralDto[];
  contractReferralStats: ProfileContractReferralStatsDto;
  referralsPagination: PaginationProps;
  contractReferralsPagination: PaginationProps;
  isLinkCopied: boolean;
  onCopyLink: (value: string) => void | Promise<void>;
};

const formatRewardAmount = (value: number | string) => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return String(value);
  }

  return numericValue.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
};

const formatPercent = (value: number | string) => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return String(value);
  }

  return numericValue.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
};

const getContractReferralSourceKey = (source: ProfileContractReferralDto["source"]) =>
  source === "scout" ? "ContractReferralSourceScout" : "ContractReferralSourceUserReferral";

export function ProfileReferralsBlock({
  botUsername,
  telegramId,
  referrals,
  contractReferrals,
  contractReferralStats,
  referralsPagination,
  contractReferralsPagination,
  isLinkCopied,
  onCopyLink,
}: Props) {
  const t = useTranslations("Profile");
  const locale = useLocale() as "ru" | "en";

  if (!telegramId) {
    return (
      <ActionCard title={t("ReferralProgram")}>
        <ActionCardInset className="border border-zinc-200 bg-transparent text-sm text-zinc-600">
          {t("ReferralLinkPending")}
        </ActionCardInset>
      </ActionCard>
    );
  }

  const referralLink = buildTelegramMiniAppUrl(
    botUsername,
    buildReferralStartParam(telegramId),
  );

  return (
    <ActionCard title={t("ReferralProgram")}>
      <ActionCardInset className="border border-zinc-200 bg-transparent">
        <p className="text-xs uppercase tracking-wide text-zinc-500">{t("ReferralLink")}</p>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            aria-label={isLinkCopied ? t("LinkCopied") : t("CopyReferralLink")}
            onClick={() => {
              triggerTelegramImpact("light");
              void onCopyLink(referralLink);
            }}
            className="group min-w-0 flex-1 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            <span className="block break-all text-base font-semibold text-zinc-950 sm:text-lg">
              {referralLink}
            </span>
            <span className="block text-[10px] font-medium text-zinc-500 transition-colors group-hover:text-zinc-700">
              {isLinkCopied ? t("LinkCopied") : t("ClickToCopy")}
            </span>
          </button>
          <TelegramStoryShareButton
            url={referralLink}
            text={buildReferralShareText(
              {
                rewardSharePercent: CONTRACT_REFERRAL_REWARD_SHARE_PERCENT,
              },
              locale,
            )}
            title={t("ShareReferralLink")}
            preparedMessage={{ type: "referral" }}
            story={{ type: "referral", url: referralLink }}
            className="shrink-0"
          />
        </div>
      </ActionCardInset>

      <div className="mt-6 flex flex-col gap-3">
        <p className="text-xs uppercase tracking-wide text-zinc-500">{t("YourReferrals")}</p>
        {referrals.length ? (
          <div className="grid gap-3">
            {referrals.map((referral) => (
              <Link
                key={referral.id}
                href={routes.profileBySlug(referral.profileSlug)}
                className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 px-4 py-3 transition hover:border-zinc-300"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-950">
                    {referral.name ||
                      (referral.telegramUsername
                        ? `@${referral.telegramUsername}`
                        : t("UserNoNameFallback", { id: referral.id }))}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {referral.telegramUsername
                      ? `@${referral.telegramUsername}`
                      : t("NoUsername")}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-zinc-500">
                  {formatDateTime(referral.createdAt)}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 py-8 text-center">
            <p className="text-sm text-zinc-500">
              {t("NoReferrals")}
            </p>
          </div>
        )}
        <ProfileInfiniteScroll {...referralsPagination} />
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <p className="text-xs uppercase tracking-wide text-zinc-500">{t("ContractReferrals")}</p>
        <div className="grid gap-3 sm:grid-cols-4">
          <ActionCardInset className="border border-zinc-200 bg-transparent">
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">
              {t("ScoutedContracts")}
            </p>
            <p className="mt-2 text-xl font-semibold text-zinc-950">
              {contractReferralStats.scoutedContractsCount}
            </p>
          </ActionCardInset>
          <ActionCardInset className="border border-zinc-200 bg-transparent">
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">
              {t("ActiveContractReferrals")}
            </p>
            <p className="mt-2 text-xl font-semibold text-zinc-950">
              {contractReferralStats.activeContractsCount}
            </p>
          </ActionCardInset>
          <ActionCardInset className="border border-zinc-200 bg-transparent">
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">
              {t("RewardedDeals")}
            </p>
            <p className="mt-2 text-xl font-semibold text-zinc-950">
              {contractReferralStats.accruedRewardsCount}
            </p>
          </ActionCardInset>
          <ActionCardInset className="border border-zinc-200 bg-transparent">
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">
              {t("ContractReferralEarnings")}
            </p>
            <p className="mt-2 text-xl font-semibold text-zinc-950">
              {formatRewardAmount(contractReferralStats.accruedRewardAmount)}{" "}
              {getEscrowCurrencyDisplayName(contractReferralStats.currency)}
            </p>
          </ActionCardInset>
        </div>

        {contractReferrals.length ? (
          <div className="grid gap-3">
            {contractReferrals.map((referral) => (
              <Link
                key={referral.id}
                href={routes.contractBySlug(referral.contract.slug)}
                className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 px-4 py-3 transition hover:border-zinc-300"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-950">
                    {referral.contract.titleRu || referral.contract.titleEn || referral.contract.slug}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {t("ContractReferralShare", {
                      percent: formatPercent(referral.rewardPercent),
                    })}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
                      {t(getContractReferralSourceKey(referral.source))}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {t("ContractReferralRewardedDeals", {
                        count: referral.rewardsCount,
                      })}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                    {t("ContractReferralAccrued")}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-emerald-700">
                    {formatRewardAmount(referral.accruedRewardAmount)}{" "}
                    {getEscrowCurrencyDisplayName(referral.currency)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 py-8 text-center">
            <p className="text-sm text-zinc-500">
              {t("NoContractReferrals")}
            </p>
          </div>
        )}
        <ProfileInfiniteScroll {...contractReferralsPagination} />
      </div>
    </ActionCard>
  );
}
