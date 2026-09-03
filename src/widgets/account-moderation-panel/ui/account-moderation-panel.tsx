"use client";

import {
  ExternalLink,
  Plus,
  Search,
  ShieldBan,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

import {
  isAccountRestrictionReasonCode,
  type CreateAccountRestrictionPayload,
  type ModeratedUserDto,
} from "@/entities/user";
import { UserBadgePill } from "@/entities/user/ui";
import { routes } from "@/shared/config/routes";
import { getUserProfileSlug } from "@/shared/lib/profile";
import { buildTelegramUserUrl } from "@/shared/lib/telegram/client";
import {
  Button,
  EmptyState,
  SurfaceCard,
  TelegramLogo,
} from "@/shared/ui";

import { RestrictionDialog } from "./restriction-dialog";

type Props = {
  currentModeratorId: number;
  users: ModeratedUserDto[];
  searchValue: string;
  isLoading: boolean;
  isError?: boolean;
  actionUserId?: number | null;
  onSearch: (value: string) => void;
  onRetry?: () => void | Promise<unknown>;
  onManageBadges: (user: ModeratedUserDto) => void;
  onCreateRestriction: (
    userId: number,
    payload: CreateAccountRestrictionPayload,
  ) => Promise<void>;
  onRevokeRestriction: (
    userId: number,
    restrictionId: number,
    comment: string,
  ) => Promise<void>;
};

export function AccountModerationPanel({
  currentModeratorId,
  users,
  searchValue,
  isLoading,
  isError = false,
  actionUserId,
  onSearch,
  onRetry,
  onManageBadges,
  onCreateRestriction,
  onRevokeRestriction,
}: Props) {
  const t = useTranslations("AccountRestrictions");
  const format = useFormatter();
  const [draftSearch, setDraftSearch] = useState(searchValue);
  const [selectedUser, setSelectedUser] = useState<ModeratedUserDto | null>(null);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    onSearch(draftSearch);
  };

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
      <SurfaceCard>
        <form onSubmit={submitSearch} className="flex flex-col gap-3 sm:flex-row">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">{t("searchAccount")}</span>
            <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={draftSearch}
              onChange={(event) => setDraftSearch(event.target.value)}
              placeholder={t("searchPlaceholder")}
              className="w-full rounded-full border border-zinc-200 bg-white py-3 pr-4 pl-11 text-sm text-zinc-950 outline-none transition focus:border-zinc-900 dark:border-white/15 dark:bg-white/5 dark:text-white"
            />
          </label>
          <Button type="submit">{t("searchButton")}</Button>
        </form>
      </SurfaceCard>

      {isLoading ? (
        <SurfaceCard>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {t("loadingAccounts")}
          </p>
        </SurfaceCard>
      ) : null}

      {!isLoading && isError ? (
        <SurfaceCard>
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-red-700 dark:text-red-300">
              {t("loadingAccountsFailed")}
            </p>
            {onRetry ? (
              <Button type="button" variant="secondary" onClick={() => void onRetry()}>
                {t("retryLoading")}
              </Button>
            ) : null}
          </div>
        </SurfaceCard>
      ) : null}

      {!isLoading && !isError && users.length === 0 ? (
        <SurfaceCard>
          <EmptyState
            title={t("accountsNotFound")}
            description={t("accountsNotFoundDescription")}
          />
        </SurfaceCard>
      ) : null}

      {users.map((user) => {
        const activeRestriction = user.accountRestrictions[0] ?? null;
        const isSelf = user.id === currentModeratorId;
        const visibleTelegramUsername = user.isTelegramUsernameHidden
          ? null
          : user.telegramUsername;
        const profileHref = routes.profileBySlug(
          getUserProfileSlug({
            id: user.id,
            telegramUsername: visibleTelegramUsername,
          }),
        );
        const telegramChatUrl = buildTelegramUserUrl({
          telegramUsername: visibleTelegramUsername,
          telegramId: user.telegramId,
        });

        return (
          <SurfaceCard key={user.id}>
            <div className="flex flex-col gap-5">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div className="flex min-w-0 gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-200">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-semibold text-zinc-950 dark:text-white">
                        {user.name ||
                          visibleTelegramUsername ||
                          t("userFallback", { id: user.id })}
                      </h3>
                      <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-white/10 dark:text-zinc-300">
                        {user.role}
                      </span>
                      {activeRestriction ? (
                        <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">
                          {t("restricted")}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-sm text-zinc-600 dark:text-zinc-400">
                      ID {user.id} · Telegram {user.telegramId}
                      {visibleTelegramUsername
                        ? ` · @${visibleTelegramUsername}`
                        : ""}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {t("accountCounts", {
                        contracts: user._count.contracts,
                        deals:
                          user._count.customerDeals +
                          user._count.freelancerDeals,
                        tickets: user._count.supportTickets,
                      })}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      {user.badges.map((badge) => (
                        <UserBadgePill key={badge.id} badge={badge} />
                      ))}
                      <button
                        type="button"
                        onClick={() => onManageBadges(user)}
                        aria-label={t("manageUserBadges", {
                          user:
                            user.name ||
                            visibleTelegramUsername ||
                            String(user.id),
                        })}
                        title={t("manageBadgesTitle")}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-zinc-300 text-zinc-500 transition hover:border-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-white/20 dark:hover:border-white/40 dark:hover:bg-white/5 dark:hover:text-white"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <Button
                    href={profileHref}
                    variant="secondary"
                    size="sm"
                    shape="rounded-full"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    {t("openProfile")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    shape="rounded-full"
                    disabled={!telegramChatUrl}
                    onClick={() => {
                      if (telegramChatUrl) {
                        window.open(
                          telegramChatUrl,
                          "_blank",
                          "noopener,noreferrer",
                        );
                      }
                    }}
                  >
                    <TelegramLogo size={16} />
                    {t("openTelegramChat")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    shape="rounded-full"
                    variant={activeRestriction ? "secondary" : "primary"}
                    disabled={isSelf || actionUserId === user.id}
                    onClick={() => setSelectedUser(user)}
                  >
                    <ShieldBan className="h-4 w-4" aria-hidden="true" />
                    {isSelf ? t("yourAccount") : t("restrict")}
                  </Button>
                </div>
              </div>

              {user.accountRestrictions.length ? (
                <div className="grid gap-3 border-t border-zinc-100 pt-4 dark:border-white/10">
                  {user.accountRestrictions.map((restriction) => (
                    <div
                      key={restriction.id}
                      className="flex flex-col justify-between gap-3 rounded-2xl bg-zinc-50 p-4 sm:flex-row sm:items-center dark:bg-white/5"
                    >
                      <div>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                          {t(`scope.${restriction.scope}`)}
                        </p>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          {restriction.publicMessage}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {t("restrictionMeta", {
                            reason: isAccountRestrictionReasonCode(
                              restriction.reasonCode,
                            )
                              ? t(`reason.${restriction.reasonCode}`)
                              : restriction.reasonCode,
                            expiresAt: restriction.expiresAt
                              ? format.dateTime(
                                  new Date(restriction.expiresAt),
                                  {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                  },
                                )
                              : t("duration.permanent"),
                          })}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={actionUserId === user.id}
                        onClick={async () => {
                          const comment = window.prompt(t("revokePrompt"));
                          if (!comment || comment.trim().length < 3) {
                            return;
                          }

                          try {
                            await onRevokeRestriction(user.id, restriction.id, comment.trim());
                          } catch {
                            // The parent mutation renders the server error above the panel.
                          }
                        }}
                      >
                        <ShieldCheck className="h-4 w-4" />
                        {t("revoke")}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </SurfaceCard>
        );
      })}

      <RestrictionDialog
        key={selectedUser?.id ?? "closed"}
        user={selectedUser}
        isPending={selectedUser?.id === actionUserId}
        onClose={() => setSelectedUser(null)}
        onSubmit={async (payload) => {
          if (!selectedUser) {
            return;
          }

          await onCreateRestriction(selectedUser.id, payload);
          setSelectedUser(null);
        }}
      />
    </div>
  );
}
