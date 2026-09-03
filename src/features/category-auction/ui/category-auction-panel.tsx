"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { ChevronDown, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  CATEGORIES_QUERY_KEY,
  getCategoryLabel,
  resolveCategoryId,
} from "@/entities/category";
import { authClient, sessionQueryKeys } from "@/entities/session";
import {
  buildJettonTransferPayload,
  FAVOR_JETTON_TRANSFER_GAS_NANO,
} from "@/shared/lib/ton";
import { BottomSheet, UserAvatar } from "@/shared/ui";
import { categoryAuctionClient, type CategoryAuctionDto } from "../api/client";
import { categoryAuctionQueryKeys } from "../model/query-keys";
import { useCategoryAuctionRealtime } from "../model/use-category-auction-realtime";

type AuctionBid = CategoryAuctionDto["bids"][number];

const nanoToFavorInput = (nano: string) => {
  const amount = BigInt(nano);
  const whole = amount / 1_000_000_000n;
  const fraction = (amount % 1_000_000_000n).toString().padStart(9, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
};

const formatFavorNano = (nano: string, locale: string) => {
  const [whole, fraction] = nanoToFavorInput(nano).split(".");
  const formattedWhole = BigInt(whole).toLocaleString(locale);
  const decimalSeparator = new Intl.NumberFormat(locale)
    .formatToParts(1.1)
    .find((part) => part.type === "decimal")?.value ?? ".";
  return fraction ? `${formattedWhole}${decimalSeparator}${fraction}` : formattedWhole;
};

const formatCompactFavorNano = (nano: string, locale: string) => {
  const favor = Number(nanoToFavorInput(nano));
  if (!Number.isFinite(favor)) return formatFavorNano(nano, locale);
  return new Intl.NumberFormat(locale, {
    notation: favor >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: favor >= 10_000 ? 1 : 2,
  }).format(favor);
};

const favorToNano = (favor: string) => {
  const normalized = favor.trim().replace(",", ".");
  if (!/^\d+(\.\d{0,9})?$/.test(normalized)) {
    throw new Error("INVALID_FAVOR_AMOUNT");
  }
  const [whole, fraction = ""] = normalized.split(".");
  return (BigInt(whole) * 1_000_000_000n + BigInt(fraction.padEnd(9, "0"))).toString();
};

const formatRemaining = (until: string | null, now: number) => {
  if (!until) return "";
  const seconds = Math.max(0, Math.ceil((new Date(until).getTime() - now) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

const formatPromotionEnd = (date: string, locale: string) =>
  new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));

const bidderName = (bid: AuctionBid, fallback: string) =>
  bid.user.telegramUsername
    ? `@${bid.user.telegramUsername.replace(/^@/, "")}`
    : bid.user.name?.trim() || fallback;

const AUCTION_ERROR_CODES = [
  "INVALID_FAVOR_AMOUNT",
  "CONNECT_FAVOR_WALLET",
  "WALLET_DOES_NOT_MATCH_ACCOUNT",
  "INSUFFICIENT_FAVOR_BALANCE",
  "BID_BELOW_DYNAMIC_START_PRICE",
  "BID_MUST_BE_AT_LEAST_10_PERCENT_HIGHER",
  "BID_RACE_LOST",
  "ONLY_ONE_AUCTION_AT_A_TIME",
  "CATEGORY_ALREADY_OCCUPIED",
  "PAYMENT_ATTEMPTS_EXHAUSTED",
  "AUCTION_PAYMENT_TURN_EXPIRED",
] as const;

type AuctionErrorCode = (typeof AUCTION_ERROR_CODES)[number];

const getAuctionErrorCode = (error: unknown): AuctionErrorCode | null => {
  const raw = error instanceof Error ? error.message : "UNKNOWN";
  return AUCTION_ERROR_CODES.find((code) => code === raw) ?? null;
};

export function CategoryAuctionPanel({ categoryName }: { categoryName: string }) {
  const locale = useLocale();
  const t = useTranslations("CategoryAuction");
  const categoryId = resolveCategoryId(categoryName) ?? categoryName;
  const categoryLabel = getCategoryLabel(categoryId, locale) ?? categoryName;
  const queryClient = useQueryClient();
  const wallet = useTonWallet();
  const [tonConnectUI] = useTonConnectUI();
  const [isOpen, setIsOpen] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const [amountFavor, setAmountFavor] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [paymentAttempt, setPaymentAttempt] = useState(0);
  const realtimeConnected = useCategoryAuctionRealtime(categoryId);
  const formatFavor = (nano: string) => formatFavorNano(nano, locale);
  const formatCompactFavor = (nano: string) => formatCompactFavorNano(nano, locale);
  const getBidderName = (bid: AuctionBid) => bidderName(
    bid,
    t("participantFallback", { id: bid.userId }),
  );
  const translateAuctionError = (error: unknown) => {
    const code = getAuctionErrorCode(error);
    return code ? t(`errors.${code}`) : t("errors.UNKNOWN");
  };

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const stateQuery = useQuery({
    queryKey: categoryAuctionQueryKeys.state(categoryId),
    queryFn: () => categoryAuctionClient.getState(categoryId),
    refetchInterval: realtimeConnected ? false : 5000,
  });
  const balanceQuery = useQuery({
    queryKey: categoryAuctionQueryKeys.favorBalance(wallet?.account.address ?? "disconnected"),
    queryFn: () => categoryAuctionClient.getFavorBalance(wallet!.account.address),
    enabled: Boolean(wallet?.account.address),
    refetchInterval: 15_000,
  });
  const meQuery = useQuery({
    queryKey: sessionQueryKeys.currentUser,
    queryFn: authClient.getMe,
  });

  const state = stateQuery.data;
  const auction = state?.auction;
  const bids = useMemo(() => auction?.bids ?? [], [auction?.bids]);
  const leader = bids.find((bid) => bid.status === "active") ?? bids[0];
  const candidate = bids.find((bid) => bid.id === auction?.currentCandidateBidId);
  const minimumNano = leader && BigInt(leader.amountNano) > 0n
    ? ((BigInt(leader.amountNano) * 110n + 99n) / 100n).toString()
    : state?.startAmountNano;
  const minimumFavor = minimumNano ? nanoToFavorInput(minimumNano) : "0";
  const desiredNano = useMemo(() => {
    if (!minimumNano) return null;
    if (!amountFavor.trim()) return BigInt(minimumNano);
    try {
      return BigInt(favorToNano(amountFavor));
    } catch {
      return null;
    }
  }, [amountFavor, minimumNano]);
  const balanceNano = balanceQuery.data ? BigInt(balanceQuery.data.balanceNano) : null;
  const canAfford = desiredNano !== null
    && balanceNano !== null
    && desiredNano >= BigInt(minimumNano ?? "0")
    && balanceNano >= desiredNano;
  const currentUserBidIndex = bids.findIndex((bid) => bid.userId === state?.currentUserId);
  const currentUserBid = currentUserBidIndex >= 0 ? bids[currentUserBidIndex] : undefined;
  const mayPay = auction?.status === "awaiting_payment"
    && currentUserBid?.id === auction.currentCandidateBidId;
  const attemptsUsed = Math.max(paymentAttempt, state?.currentUserPaymentAttempts ?? 0);
  const blockedByAnotherAuctionOrPromotion = Boolean(
    state?.participatingAuctionId && state.participatingAuctionId !== auction?.id,
  );
  const categoryIsPromoted = Boolean(state?.categoryPromotionEndsAt);
  const timeLabel = now === null
    ? ""
    : auction?.status === "open"
      ? formatRemaining(auction.biddingEndsAt, now)
      : formatRemaining(auction?.paymentDeadlineAt ?? null, now);
  const actionAmount = desiredNano === null
    ? minimumNano
    : desiredNano.toString();

  const closeSheet = useCallback(() => setIsOpen(false), []);
  const openSheet = () => {
    setAmountFavor("");
    setMessage(null);
    setParticipantsOpen(false);
    setRulesOpen(false);
    setIsOpen(true);
  };

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: categoryAuctionQueryKeys.state(categoryId) });
    await queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
  };

  const startMutation = useMutation({
    mutationFn: (usePremiumFree: boolean) => categoryAuctionClient.start({
      categoryName: categoryId,
      usePremiumFree,
      amountNano: usePremiumFree
        ? undefined
        : favorToNano(amountFavor || nanoToFavorInput(state!.startAmountNano)),
      userWalletAddress: usePremiumFree ? undefined : wallet?.account.address,
    }),
    onSuccess: async () => {
      setMessage(t("messages.auctionStarted"));
      setAmountFavor("");
      await refresh();
    },
    onError: (error) => setMessage(translateAuctionError(error)),
  });

  const bidMutation = useMutation({
    mutationFn: () => {
      if (!auction || !wallet) throw new Error("CONNECT_FAVOR_WALLET");
      return categoryAuctionClient.bid(auction.id, {
        amountNano: favorToNano(amountFavor || minimumFavor),
        userWalletAddress: wallet.account.address,
      });
    },
    onSuccess: async () => {
      setMessage(t("messages.bidAccepted"));
      setAmountFavor("");
      await refresh();
    },
    onError: (error) => setMessage(translateAuctionError(error)),
  });

  const pay = async (retry: boolean) => {
    if (!auction || !wallet) throw new Error("CONNECT_FAVOR_WALLET");
    setMessage(retry ? t("messages.preparingRetry") : t("messages.preparingPayment"));
    const prepared = await categoryAuctionClient.preparePayment(auction.id, {
      userWalletAddress: wallet.account.address,
    });
    const payload = buildJettonTransferPayload({
      amount: BigInt(prepared.amountNano),
      recipientAddress: prepared.recipientAddress,
      responseAddress: wallet.account.address,
      reference: prepared.reference,
    });
    const transaction = await tonConnectUI.sendTransaction({
      validUntil: Math.min(
        Math.floor(new Date(prepared.expiresAt).getTime() / 1000),
        prepared.serverTime + 300,
      ),
      messages: [{
        address: prepared.userJettonWalletAddress,
        amount: FAVOR_JETTON_TRANSFER_GAS_NANO,
        payload,
      }],
    });
    setPaymentAttempt((current) => current + 1);
    setMessage(t("messages.transactionSent"));
    await categoryAuctionClient.confirmPayment(prepared.paymentIntentId, transaction.boc);
    setMessage(t("messages.paymentConfirmed"));
    await refresh();
  };

  const connectWallet = () => void tonConnectUI.openModal();
  const triggerStatus = stateQuery.isLoading
    ? t("checkingStatus")
    : auction?.status === "open"
      ? timeLabel
        ? t("activeStatus", {
            bid: leader
              ? t("favorAmount", { amount: formatFavor(leader.amountNano) })
              : t("biddingInProgress"),
            time: timeLabel,
          })
        : leader
          ? t("favorAmount", { amount: formatFavor(leader.amountNano) })
          : t("biddingInProgress")
      : auction?.status === "awaiting_payment"
        ? t("paymentPendingStatus")
        : state?.categoryPromotionEndsAt
          ? t("occupiedUntil", {
              date: formatPromotionEnd(state.categoryPromotionEndsAt, locale),
            })
          : t("placeAvailable");

  return (
    <>
      <div className="flex min-h-12 items-center justify-between gap-3 border-y border-[var(--border-soft)] py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-zinc-950 dark:text-zinc-100">
            {categoryLabel}
          </p>
          <p className="truncate text-xs text-[var(--muted-foreground)]">{triggerStatus}</p>
        </div>
        <button
          type="button"
          onClick={openSheet}
          className="shrink-0 rounded-xl border border-[#0f8c5c]/45 px-3 py-2 text-xs font-semibold text-[#0f8c5c] transition hover:bg-[#0f8c5c]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8c5c]/30 dark:border-brand-accent/45 dark:text-brand-accent dark:hover:bg-brand-accent/5"
        >
          {t("firstPlace")}
        </button>
      </div>

      <BottomSheet
        isOpen={isOpen}
        onClose={closeSheet}
        ariaLabel={t("sheetAria", { category: categoryLabel })}
        closeLabel={t("close")}
        contentClassName="sm:max-w-3xl"
      >
        <div className="px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-6">
          {stateQuery.isLoading ? (
            <AuctionLoading categoryName={categoryLabel} onClose={closeSheet} />
          ) : stateQuery.isError || !state ? (
            <>
              <SheetHeader title={t("firstPlace")} categoryName={categoryLabel} onClose={closeSheet} />
              <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
                {t("loadError")}
              </div>
              <button
                type="button"
                onClick={() => void stateQuery.refetch()}
                className="mt-3 w-full rounded-2xl bg-brand-accent px-4 py-3 text-sm font-bold text-zinc-950"
              >
                {t("retry")}
              </button>
            </>
          ) : categoryIsPromoted ? (
            <OccupiedState
              categoryName={categoryLabel}
              endsAt={state.categoryPromotionEndsAt!}
              onClose={closeSheet}
            />
          ) : blockedByAnotherAuctionOrPromotion && !auction ? (
            <BlockedState categoryName={categoryLabel} onClose={closeSheet} />
          ) : !auction ? (
            <>
              <SheetHeader title={t("firstPlace")} categoryName={categoryLabel} onClose={closeSheet} />
              <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-zinc-900/60">
                <Metric
                  label={t("start")}
                  value={t("startingAt", { amount: formatFavor(state.startAmountNano) })}
                />
                <Metric
                  label={t("duration")}
                  value={t("sevenDays")}
                  className="border-l border-zinc-200 dark:border-white/10"
                />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div>
                  <p className="mb-1.5 text-xs font-medium text-zinc-500">{t("yourBid")}</p>
                  <AmountInput
                    value={amountFavor}
                    onChange={setAmountFavor}
                    placeholder={minimumFavor}
                  />
                </div>
                <button
                  type="button"
                  disabled={Boolean(wallet) && (!canAfford || startMutation.isPending)}
                  onClick={() => wallet ? startMutation.mutate(false) : connectWallet()}
                  className="h-12 self-end rounded-2xl bg-brand-accent px-6 text-sm font-bold text-zinc-950 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {wallet ? t("startAuction") : t("connectWallet")}
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                <span>
                  {wallet
                    ? balanceQuery.data
                      ? t("availableBalance", {
                          amount: formatCompactFavor(balanceQuery.data.balanceNano),
                        })
                      : t("checkingBalance")
                    : t("chargedOnlyIfWin")}
                </span>
                {meQuery.data?.isPremium ? (
                  <button
                    type="button"
                    disabled={!state.premiumFreeAvailable || startMutation.isPending}
                    onClick={() => startMutation.mutate(true)}
                    className="font-semibold text-[#0f8c5c] disabled:text-zinc-400 dark:text-brand-accent"
                  >
                    {state.premiumFreeAvailable ? t("favorPlusFree") : t("favorPlusUsed")}
                  </button>
                ) : null}
              </div>

              <AuctionFooter
                rulesOpen={rulesOpen}
                onRulesToggle={() => setRulesOpen((current) => !current)}
              />
              <StatusMessage message={message} />
            </>
          ) : auction.status === "open" ? (
            <>
              <SheetHeader title={t("firstPlace")} categoryName={categoryLabel} onClose={closeSheet} />

              <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-zinc-200 p-3 dark:border-white/10">
                  {leader ? (
                    <UserAvatar
                      avatarUrl={leader.user.avatarUrl}
                      displayName={getBidderName(leader)}
                      className="h-14 w-14 sm:h-16 sm:w-16"
                      fallbackClassName="text-lg"
                      sizes="64px"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <p className="text-xs text-zinc-500">{t("auctionLeader")}</p>
                    <p className="truncate text-base font-bold text-zinc-950 dark:text-zinc-100">
                      {leader ? getBidderName(leader) : "—"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-zinc-900/60">
                  <Metric
                    label={t("currentBid")}
                    value={t("favorAmount", {
                      amount: leader ? formatFavor(leader.amountNano) : "0",
                    })}
                  />
                  <Metric
                    label={t("timeRemaining")}
                    value={timeLabel || "—"}
                    valueClassName="text-[#0f8c5c] dark:text-brand-accent"
                    className="border-l border-zinc-200 dark:border-white/10"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setParticipantsOpen((current) => !current)}
                className="mt-4 flex w-full items-center justify-between gap-3 rounded-2xl border border-zinc-200 px-3 py-3 text-left transition hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-white/[0.03]"
                aria-expanded={participantsOpen}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <AvatarStack bids={bids} />
                  <span className="whitespace-nowrap text-sm font-medium text-zinc-700 dark:text-zinc-200">
                    {t("participants", { count: bids.length })}
                  </span>
                </div>
                <div className="flex min-w-0 items-center gap-2 text-xs sm:text-sm">
                  {currentUserBid ? (
                    <span className="truncate font-semibold text-[#0f8c5c] dark:text-brand-accent">
                      {t("yourBidSummary", {
                        place: currentUserBidIndex + 1,
                        amount: formatFavor(currentUserBid.amountNano),
                      })}
                    </span>
                  ) : (
                    <span className="text-zinc-500">{t("showBids")}</span>
                  )}
                  <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-500 transition ${participantsOpen ? "rotate-180" : ""}`} />
                </div>
              </button>

              {participantsOpen ? <ParticipantList bids={bids} currentUserId={state.currentUserId} /> : null}

              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between gap-3 text-xs text-zinc-500">
                  <span>{t("minimumBid", { amount: formatFavor(minimumNano ?? "0") })}</span>
                  {wallet ? (
                    <span>
                      {balanceQuery.data
                        ? t("availableBalance", {
                            amount: formatCompactFavor(balanceQuery.data.balanceNano),
                          })
                        : t("checkingBalance")}
                    </span>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <AmountInput
                    value={amountFavor}
                    onChange={setAmountFavor}
                    placeholder={minimumFavor}
                  />
                  <button
                    type="button"
                    disabled={Boolean(wallet) && (!canAfford || bidMutation.isPending)}
                    onClick={() => wallet ? bidMutation.mutate() : connectWallet()}
                    className="h-12 rounded-2xl bg-brand-accent px-6 text-sm font-bold text-zinc-950 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {wallet
                      ? bidMutation.isPending
                        ? t("placingBid")
                        : t("placeBid", {
                            amount: formatFavor(actionAmount ?? minimumNano ?? "0"),
                          })
                      : t("connectWallet")}
                  </button>
                </div>
              </div>

              <AuctionFooter
                rulesOpen={rulesOpen}
                onRulesToggle={() => setRulesOpen((current) => !current)}
              />
              <StatusMessage message={message} />
            </>
          ) : mayPay ? (
            <>
              <SheetHeader title={t("wonTitle")} categoryName={categoryLabel} onClose={closeSheet} />
              <div className="mt-5 flex items-center gap-3">
                {candidate ? (
                  <UserAvatar
                    avatarUrl={candidate.user.avatarUrl}
                    displayName={getBidderName(candidate)}
                    className="h-12 w-12"
                    sizes="48px"
                  />
                ) : null}
                <div>
                  <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">
                    {t("youAreWinner")}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {t("paymentAttempt", { attempt: Math.min(attemptsUsed + 1, 2), total: 2 })}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-zinc-900/60">
                <Metric
                  label={t("amountDue")}
                  value={t("favorAmount", { amount: formatFavor(currentUserBid!.amountNano) })}
                />
                <Metric
                  label={t("timeRemaining")}
                  value={timeLabel || "—"}
                  valueClassName="text-[#0f8c5c] dark:text-brand-accent"
                  className="border-l border-zinc-200 dark:border-white/10"
                />
              </div>
              <button
                type="button"
                disabled={attemptsUsed >= 2}
                onClick={() => wallet
                  ? void pay(attemptsUsed > 0).catch((error) => setMessage(translateAuctionError(error)))
                  : connectWallet()}
                className="mt-4 w-full rounded-2xl bg-brand-accent px-5 py-3.5 text-sm font-bold text-zinc-950 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {wallet
                  ? attemptsUsed > 0
                    ? t("retryPayment")
                    : t("payAndPromote")
                  : t("connectWallet")}
              </button>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 pt-4 text-xs text-zinc-500 dark:border-white/10">
                <span>{t("burnNotice")}</span>
                <span>{t("paymentWindow")}</span>
              </div>
              <StatusMessage message={message} />
            </>
          ) : (
            <>
              <SheetHeader title={t("awaitingPaymentTitle")} categoryName={categoryLabel} onClose={closeSheet} />
              {candidate ? (
                <div className="mt-5 flex items-center gap-3">
                  <UserAvatar
                    avatarUrl={candidate.user.avatarUrl}
                    displayName={getBidderName(candidate)}
                    className="h-14 w-14"
                    fallbackClassName="text-lg"
                    sizes="56px"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold text-zinc-950 dark:text-zinc-100">
                      {getBidderName(candidate)}
                    </p>
                    <p className="text-sm text-zinc-500">{t("confirmingWin")}</p>
                  </div>
                </div>
              ) : null}
              <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-zinc-900/60">
                <Metric
                  label={t("bid")}
                  value={candidate
                    ? t("favorAmount", { amount: formatFavor(candidate.amountNano) })
                    : "—"}
                />
                <Metric
                  label={t("timeRemaining")}
                  value={timeLabel || "—"}
                  valueClassName="text-[#0f8c5c] dark:text-brand-accent"
                  className="border-l border-zinc-200 dark:border-white/10"
                />
              </div>
              <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 px-3 py-3 dark:border-white/10">
                <div className="flex min-w-0 items-center gap-3">
                  <AvatarStack bids={bids} />
                  <span className="text-sm text-zinc-600 dark:text-zinc-300">
                    {t("participantQueue")}
                  </span>
                </div>
                {currentUserBidIndex > 0 ? (
                  <span className="text-xs font-semibold text-[#0f8c5c] dark:text-brand-accent">
                    {t("yourQueuePlace", { place: currentUserBidIndex + 1 })}
                  </span>
                ) : null}
              </div>
              <p className="mt-4 text-xs leading-5 text-zinc-500">
                {t("queueMovesOnFailure")}
              </p>
            </>
          )}
        </div>
      </BottomSheet>
    </>
  );
}

function SheetHeader({
  title,
  categoryName,
  onClose,
}: {
  title: string;
  categoryName: string;
  onClose: () => void;
}) {
  const t = useTranslations("CategoryAuction");

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-xl font-extrabold tracking-tight text-zinc-950 dark:text-white sm:text-2xl">
          {title}
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="max-w-full truncate rounded-full border border-[#0f8c5c]/40 px-2.5 py-1 text-xs font-semibold text-[#0f8c5c] dark:border-brand-accent/40 dark:text-brand-accent">
            {categoryName}
          </span>
          <span className="text-xs text-zinc-500">{t("durationSevenDays")}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={t("close")}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-900 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function Metric({
  label,
  value,
  className = "",
  valueClassName = "",
}: {
  label: string;
  value: string;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={`min-w-0 px-4 py-4 sm:px-5 ${className}`}>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-1 truncate text-lg font-extrabold tracking-tight text-zinc-950 dark:text-white sm:text-xl ${valueClassName}`}>
        {value}
      </p>
    </div>
  );
}

function AmountInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const t = useTranslations("CategoryAuction");

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="decimal"
        aria-label={t("amountInputAria")}
        placeholder={placeholder}
        className="h-12 w-full rounded-2xl border border-zinc-300 bg-transparent px-4 pr-20 text-base font-semibold text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-[#0f8c5c] dark:border-white/15 dark:text-white dark:focus:border-brand-accent"
      />
      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-zinc-500">
        FAVOR
      </span>
    </div>
  );
}

function AvatarStack({ bids }: { bids: AuctionBid[] }) {
  const t = useTranslations("CategoryAuction");

  return (
    <div className="flex shrink-0 -space-x-2">
      {bids.slice(0, 3).map((bid) => (
        <UserAvatar
          key={bid.id}
          avatarUrl={bid.user.avatarUrl}
          displayName={bidderName(bid, t("participantFallback", { id: bid.userId }))}
          className="h-8 w-8 ring-2 ring-white dark:ring-[#0a0a0a]"
          fallbackClassName="text-xs"
          sizes="32px"
        />
      ))}
    </div>
  );
}

function ParticipantList({
  bids,
  currentUserId,
}: {
  bids: AuctionBid[];
  currentUserId: number | null;
}) {
  const locale = useLocale();
  const t = useTranslations("CategoryAuction");

  return (
    <div className="mt-2 grid gap-1 rounded-2xl border border-zinc-200 p-2 dark:border-white/10">
      {bids.map((bid, index) => {
        const isCurrentUser = bid.userId === currentUserId;
        return (
          <div
            key={bid.id}
            className={`flex items-center gap-3 rounded-xl px-2.5 py-2 ${
              isCurrentUser ? "bg-[#0f8c5c]/5 dark:bg-brand-accent/5" : ""
            }`}
          >
            <span className="w-4 text-center text-xs font-semibold text-zinc-400">{index + 1}</span>
            <UserAvatar
              avatarUrl={bid.user.avatarUrl}
              displayName={bidderName(bid, t("participantFallback", { id: bid.userId }))}
              className="h-9 w-9"
              sizes="36px"
            />
            <span className={`min-w-0 flex-1 truncate text-sm font-semibold ${
              isCurrentUser
                ? "text-[#0f8c5c] dark:text-brand-accent"
                : "text-zinc-800 dark:text-zinc-100"
            }`}>
              {isCurrentUser
                ? t("you")
                : bidderName(bid, t("participantFallback", { id: bid.userId }))}
            </span>
            <span className={`text-sm font-bold ${
              isCurrentUser
                ? "text-[#0f8c5c] dark:text-brand-accent"
                : "text-zinc-950 dark:text-white"
            }`}>
              {t("favorAmount", { amount: formatFavorNano(bid.amountNano, locale) })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function AuctionFooter({
  rulesOpen,
  onRulesToggle,
}: {
  rulesOpen: boolean;
  onRulesToggle: () => void;
}) {
  const t = useTranslations("CategoryAuction");

  return (
    <div className="mt-5 border-t border-zinc-200 pt-4 dark:border-white/10">
      <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
        <span>{t("chargedOnlyIfWin")}</span>
        <button
          type="button"
          onClick={onRulesToggle}
          className="inline-flex items-center gap-1.5 font-semibold text-[#0f8c5c] dark:text-brand-accent"
          aria-expanded={rulesOpen}
        >
          {t("rules")}
          <ChevronDown className={`h-3.5 w-3.5 transition ${rulesOpen ? "rotate-180" : ""}`} />
        </button>
      </div>
      {rulesOpen ? (
        <div className="mt-3 grid gap-2 rounded-2xl bg-zinc-50 p-3 text-xs leading-5 text-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-300 sm:grid-cols-2">
          <span>{t("ruleMinimum")}</span>
          <span>{t("ruleDuration")}</span>
          <span>{t("ruleExtension")}</span>
          <span>{t("rulePayment")}</span>
        </div>
      ) : null}
    </div>
  );
}

function OccupiedState({
  categoryName,
  endsAt,
  onClose,
}: {
  categoryName: string;
  endsAt: string;
  onClose: () => void;
}) {
  const locale = useLocale();
  const t = useTranslations("CategoryAuction");

  return (
    <>
      <SheetHeader title={t("occupiedTitle")} categoryName={categoryName} onClose={onClose} />
      <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-5 dark:border-white/10 dark:bg-zinc-900/60">
        <p className="text-xs text-zinc-500">{t("availableAfter")}</p>
        <p className="mt-1 text-xl font-extrabold text-zinc-950 dark:text-white">
          {formatPromotionEnd(endsAt, locale)}
        </p>
      </div>
    </>
  );
}

function BlockedState({ categoryName, onClose }: { categoryName: string; onClose: () => void }) {
  const t = useTranslations("CategoryAuction");

  return (
    <>
      <SheetHeader title={t("blockedTitle")} categoryName={categoryName} onClose={onClose} />
      <p className="mt-5 text-sm text-zinc-500">
        {t("blockedDescription")}
      </p>
    </>
  );
}

function AuctionLoading({ categoryName, onClose }: { categoryName: string; onClose: () => void }) {
  const t = useTranslations("CategoryAuction");

  return (
    <>
      <SheetHeader title={t("firstPlace")} categoryName={categoryName} onClose={onClose} />
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="h-24 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
        <div className="h-24 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
      </div>
      <div className="mt-3 h-12 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
    </>
  );
}

function StatusMessage({ message }: { message: string | null }) {
  return message ? (
    <p className="mt-3 rounded-xl bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
      {message}
    </p>
  ) : null;
}
