"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  ExternalLink,
  Gift,
  Sparkles,
  WalletCards,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";

import {
  FAVOR_SUBSCRIPTION_DURATION,
  type SubscriptionBenefitDto,
  type SubscriptionOfferDto,
  type SubscriptionOfferPlanDto,
} from "@/entities/subscription";
import { siteConfig } from "@/shared/config/client";
import {
  openTelegramProblemReport,
  triggerTelegramImpact,
} from "@/shared/lib/telegram/client";
import {
  ActionDialog,
  BadgePill,
  BottomSheet,
  Button,
  FavorPlusLogo,
} from "@/shared/ui";

import type {
  FavorSubscriptionDuration,
  FavorSubscriptionMode,
  FavorSubscriptionTarget,
} from "../model/types";

export type FavorSubscriptionDialogStep = "plans" | "payment";

type Props = {
  isOpen: boolean;
  step: FavorSubscriptionDialogStep;
  mode: FavorSubscriptionMode;
  target: FavorSubscriptionTarget;
  offer: SubscriptionOfferDto | undefined;
  offerPending: boolean;
  offerError: boolean;
  selectedDuration: FavorSubscriptionDuration;
  telegramSubscriptionMessage: string | null;
  tonSubscriptionMessage: string | null;
  favorSubscriptionMessage: string | null;
  telegramPending: boolean;
  tonPaymentPending: boolean;
  favorPaymentPending: boolean;
  pendingCancellationPending: boolean;
  checkoutLocked: boolean;
  canCancelPendingCheckout: boolean;
  tonWalletConnected: boolean;
  tonConnectionRestored: boolean;
  onClose: () => void;
  onBack: () => void;
  onContinue: () => void;
  onRetryOffer: () => void;
  onSelectDuration: (duration: FavorSubscriptionDuration) => void;
  onConnectWallet: () => void;
  onTelegramPay: () => void;
  onTonPay: (expectedAmountNano: string) => void;
  onFavorPay: (expectedAmountNano: string) => void;
  onCancelPendingCheckout: () => void;
};

export function FavorSubscriptionDialog({
  isOpen,
  step,
  mode,
  target,
  offer,
  offerPending,
  offerError,
  selectedDuration,
  telegramSubscriptionMessage,
  tonSubscriptionMessage,
  favorSubscriptionMessage,
  telegramPending,
  tonPaymentPending,
  favorPaymentPending,
  pendingCancellationPending,
  checkoutLocked,
  canCancelPendingCheckout,
  tonWalletConnected,
  tonConnectionRestored,
  onClose,
  onBack,
  onContinue,
  onRetryOffer,
  onSelectDuration,
  onConnectWallet,
  onTelegramPay,
  onTonPay,
  onFavorPay,
  onCancelPendingCheckout,
}: Props) {
  const t = useTranslations("FavorSubscription");
  const locale = useLocale();
  const selectedPlan = offer?.plans.find(
    (plan) => plan.duration === selectedDuration,
  );
  const isGift = mode === "gift";
  const title = isGift
    ? target.isPremium
      ? t("ExtendGiftSubscriptionTitle")
      : t("GiftSubscriptionTitle")
    : target.isPremium
      ? t("ExtendSubscriptionTitle")
      : t("SubscriptionTitle");
  const description = isGift
    ? target.isPremium
      ? t("ExtendGiftSubscriptionDesc", { name: target.displayName })
      : t("GiftSubscriptionDesc", { name: target.displayName })
    : target.isPremium
      ? t("ExtendSubscriptionDesc")
      : t("SubscriptionDesc");

  return (
    <>
      <ActionDialog
        isOpen={isOpen && step === "plans"}
        onClose={onClose}
        ariaLabel={title}
        contentClassName="max-w-2xl border border-[var(--border-soft)] bg-[var(--surface)]"
        actions={
          offerError ? (
            <Button
              type="button"
              variant="secondary"
              size="lg"
              shape="rounded-full"
              fullWidth
              onClick={onRetryOffer}
            >
              {t("RetryOffer")}
            </Button>
          ) : (
            <Button
              type="button"
              variant="accent"
              size="lg"
              shape="rounded-full"
              fullWidth
              disabled={!selectedPlan || offerPending || checkoutLocked}
              onClick={() => {
                triggerTelegramImpact("medium");
                onContinue();
              }}
            >
              {isGift ? t("ContinueGift") : t("SubscriptionContinue")}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          )
        }
      >
        <div className="relative">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            shape="rounded-full"
            className="absolute -right-2 -top-2 min-h-11 min-w-11 p-0"
            aria-label={t("Close")}
            onClick={onClose}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </Button>

          <div className="flex flex-col items-center px-10 text-center">
            <div className="flex items-center gap-2 text-2xl font-black tracking-tight text-[var(--foreground)] sm:text-3xl">
              Favor <FavorPlusLogo size={34} />
            </div>
            {isGift ? (
              <BadgePill
                icon={<Gift className="h-3.5 w-3.5" aria-hidden="true" />}
                label={t("GiftFor", { name: target.displayName })}
                className="mt-3 max-w-full normal-case tracking-normal"
              />
            ) : null}
            <h2 className="mt-4 text-lg font-bold text-[var(--foreground)]">
              {title}
            </h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-[var(--muted-foreground)]">
              {description}
            </p>
            {checkoutLocked ? (
              <PendingCheckoutNotice
                canCancel={canCancelPendingCheckout}
                cancellationPending={pendingCancellationPending}
                onCancel={onCancelPendingCheckout}
              />
            ) : null}
          </div>

          {offerPending ? (
            <OfferSkeleton />
          ) : offerError || !offer ? (
            <div className="mt-6 rounded-3xl border border-red-500/20 bg-red-500/5 p-5 text-center">
              <CircleAlert
                className="mx-auto h-6 w-6 text-red-600 dark:text-red-400"
                aria-hidden="true"
              />
              <p className="mt-3 text-sm text-red-700 dark:text-red-300">
                {t("OfferLoadError")}
              </p>
            </div>
          ) : (
            <>
              <BenefitsTable benefits={offer.benefits} />
              <div className="mt-7">
                <h3 className="text-center text-xs font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                  {t("SelectPlan")}
                </h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {offer.plans.map((plan) => (
                    <PlanButton
                      key={plan.duration}
                      plan={plan}
                      selected={plan.duration === selectedDuration}
                      yearlyDiscountPercent={offer.discounts.yearlyPercent}
                      disabled={checkoutLocked}
                      onSelect={onSelectDuration}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </ActionDialog>

      <BottomSheet
        isOpen={isOpen && step === "payment"}
        onClose={onClose}
        onBack={onBack}
        ariaLabel={t("SelectPaymentMethod")}
        closeLabel={t("Close")}
        contentClassName="pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        <div className="px-5 pb-2 pt-2 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              shape="rounded-full"
              className="min-h-11 min-w-11 p-0"
              aria-label={t("BackToPlans")}
              onClick={onBack}
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </Button>
            <div className="min-w-0 text-center">
              <h2 className="truncate text-base font-bold text-[var(--foreground)]">
                {t("SelectPaymentMethod")}
              </h2>
              <p className="mt-0.5 truncate text-xs text-[var(--muted-foreground)]">
                {isGift
                  ? t("GiftFor", { name: target.displayName })
                  : target.isPremium
                    ? t("ExtensionForAccount")
                    : t("SubscriptionTitle")}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              shape="rounded-full"
              className="min-h-11 min-w-11 p-0"
              aria-label={t("Close")}
              onClick={onClose}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </Button>
          </div>

          {selectedPlan ? <SelectedPlanSummary plan={selectedPlan} /> : null}
          {checkoutLocked ? (
            <PendingCheckoutNotice
              canCancel={canCancelPendingCheckout}
              cancellationPending={pendingCancellationPending}
              onCancel={onCancelPendingCheckout}
            />
          ) : null}

          <div className="mt-4 space-y-3">
            <PaymentMethod
              icon={<Sparkles className="h-5 w-5" aria-hidden="true" />}
              title={t("PayStars")}
              description={t("PayStarsDesc")}
              price={
                selectedPlan
                  ? t("Stars", { price: selectedPlan.telegramStars.amount })
                  : "—"
              }
              message={telegramSubscriptionMessage}
              actionLabel={t("PayStars")}
              pending={telegramPending}
              disabled={!selectedPlan || checkoutLocked}
              onAction={onTelegramPay}
            />

            <PaymentMethod
              icon={<WalletCards className="h-5 w-5" aria-hidden="true" />}
              title={t("PayGramTitle")}
              description={
                tonConnectionRestored ? t("PayGramDesc") : t("TonRestoring")
              }
              price={selectedPlan ? `${selectedPlan.gram.amount} GRAM` : "—"}
              message={tonSubscriptionMessage}
              actionLabel={
                tonWalletConnected ? t("PayTon") : t("ConnectWalletInline")
              }
              pending={tonPaymentPending}
              disabled={
                !selectedPlan || !tonConnectionRestored || checkoutLocked
              }
              onAction={
                tonWalletConnected && selectedPlan
                  ? () => onTonPay(selectedPlan.gram.amountNano)
                  : onConnectWallet
              }
            />

            {selectedPlan?.favor ? (
              <PaymentMethod
                icon={<FavorPlusLogo size={20} />}
                title={t("PayFavorJettons")}
                description={t("FavorOfferShort")}
                price={t("FavorAmount", {
                  amount: BigInt(selectedPlan.favor.amount).toLocaleString(
                    locale,
                  ),
                })}
                message={favorSubscriptionMessage}
                actionLabel={
                  tonWalletConnected
                    ? t("PayFavorAction", {
                        amount: BigInt(
                          selectedPlan.favor.amount,
                        ).toLocaleString(locale),
                      })
                    : t("ConnectWalletInline")
                }
                pending={favorPaymentPending}
                disabled={!tonConnectionRestored || checkoutLocked}
                onAction={
                  tonWalletConnected
                    ? () => onFavorPay(selectedPlan.favor!.amountNano)
                    : onConnectWallet
                }
                secondaryAction={
                  <a
                    href={siteConfig.links.stonfi}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-brand-accent-ink underline decoration-brand-accent/50 underline-offset-4 dark:text-brand-accent"
                  >
                    {t("BuyFavorStonFi")}
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                }
              />
            ) : null}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            shape="rounded-full"
            className="mt-3 min-h-11 w-full text-xs"
            onClick={() => openTelegramProblemReport("subscription_payment")}
          >
            {t("ReportProblem")}
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}

function OfferSkeleton() {
  return (
    <div className="mt-6 animate-pulse space-y-4" aria-hidden="true">
      <div className="h-48 rounded-3xl bg-[var(--surface-muted)]" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-32 rounded-3xl bg-[var(--surface-muted)]" />
        <div className="h-32 rounded-3xl bg-[var(--surface-muted)]" />
      </div>
    </div>
  );
}

function PendingCheckoutNotice({
  canCancel,
  cancellationPending,
  onCancel,
}: {
  canCancel: boolean;
  cancellationPending: boolean;
  onCancel: () => void;
}) {
  const t = useTranslations("FavorSubscription");

  return (
    <div className="mt-3 rounded-2xl border border-brand-accent/25 bg-brand-accent/10 px-4 py-3 text-xs font-medium leading-5 text-brand-accent-ink dark:text-brand-accent">
      <p role="status">{t("CheckoutPendingNotice")}</p>
      {canCancel ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          shape="rounded-full"
          className="mt-2 min-h-11"
          loading={cancellationPending}
          onClick={onCancel}
        >
          {t("CancelPendingPayment")}
        </Button>
      ) : null}
    </div>
  );
}

function BenefitsTable({ benefits }: { benefits: SubscriptionBenefitDto[] }) {
  const t = useTranslations("FavorSubscription");
  const labelKeys = {
    active_contracts: "CompareActiveContracts",
    scout_contracts: "CompareScoutContracts",
    contact_views: "CompareContactViews",
    feed_priority: "CompareFeedPriority",
    og_previews: "CompareOgPreviews",
  } as const;

  return (
    <div className="mt-6 overflow-hidden rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-muted)]">
      <table className="w-full table-fixed text-xs">
        <thead className="border-b border-[var(--border-soft)] text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
          <tr>
            <th className="w-1/2 px-4 py-3 text-left" scope="col">
              {t("CompareBenefits")}
            </th>
            <th className="w-1/4 px-2 py-3 text-center" scope="col">
              {t("CompareFree")}
            </th>
            <th
              className="w-1/4 px-2 py-3 text-center text-brand-accent-ink dark:text-brand-accent"
              scope="col"
            >
              {t("ComparePlus")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-soft)]">
          {benefits.map((benefit) => (
            <tr key={benefit.id} className="min-h-12">
              <th
                className="px-4 py-3 pr-2 text-left font-semibold text-[var(--foreground)]"
                scope="row"
              >
                {t(labelKeys[benefit.id])}
              </th>
              <td className="px-2 py-3 text-center text-[var(--muted-foreground)]">
                <BenefitValue value={benefit.free} />
              </td>
              <td className="px-2 py-3 text-center font-extrabold text-brand-accent-ink dark:text-brand-accent">
                <BenefitValue value={benefit.plus} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BenefitValue({
  value,
}: {
  value: SubscriptionBenefitDto["free"] | SubscriptionBenefitDto["plus"];
}) {
  const t = useTranslations("FavorSubscription");

  if (value === true) {
    return <Check className="h-4 w-4" aria-label={t("Available")} />;
  }
  if (value === false) {
    return <span aria-label={t("Unavailable")}>—</span>;
  }
  if (value === "limited") return <span>{t("CompareLimited")}</span>;
  if (value === "unlimited") return <span>{t("CompareUnlimited")}</span>;
  return <span>{value}</span>;
}

function PlanButton({
  plan,
  selected,
  yearlyDiscountPercent,
  disabled,
  onSelect,
}: {
  plan: SubscriptionOfferPlanDto;
  selected: boolean;
  yearlyDiscountPercent: number;
  disabled: boolean;
  onSelect: (duration: FavorSubscriptionDuration) => void;
}) {
  const t = useTranslations("FavorSubscription");

  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={() => {
        triggerTelegramImpact("light");
        onSelect(plan.duration);
      }}
      className={`relative min-h-32 rounded-3xl border-2 p-5 text-left transition disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] ${
        selected
          ? "border-brand-accent bg-brand-accent/10"
          : "border-[var(--border-soft)] bg-[var(--surface)] hover:bg-[var(--surface-muted)]"
      }`}
    >
      {plan.duration === FAVOR_SUBSCRIPTION_DURATION ? (
        <BadgePill
          label={t("DiscountPercent", { percent: yearlyDiscountPercent })}
          className="absolute -top-3 right-4"
        />
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <span className="font-bold text-[var(--foreground)]">
          {plan.duration === FAVOR_SUBSCRIPTION_DURATION
            ? t("OneYear")
            : t("OneMonth")}
        </span>
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full border ${
            selected
              ? "border-brand-accent bg-brand-accent text-brand-accent-ink"
              : "border-[var(--border-soft)]"
          }`}
          aria-hidden="true"
        >
          {selected ? <Check className="h-4 w-4" /> : null}
        </span>
      </div>
      <p className="mt-5 text-2xl font-black text-[var(--foreground)]">
        {plan.telegramStars.amount}
        <span className="ml-1.5 text-xs font-medium text-[var(--muted-foreground)]">
          Stars
        </span>
      </p>
      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
        {plan.gram.amount} GRAM
      </p>
    </button>
  );
}

function SelectedPlanSummary({ plan }: { plan: SubscriptionOfferPlanDto }) {
  const t = useTranslations("FavorSubscription");

  return (
    <div className="mt-4 flex items-center justify-between rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-3">
      <div>
        <p className="text-xs text-[var(--muted-foreground)]">{t("PlanLabel")}</p>
        <p className="mt-0.5 text-sm font-bold text-[var(--foreground)]">
          {plan.duration === FAVOR_SUBSCRIPTION_DURATION
            ? t("OneYear")
            : t("OneMonth")}
        </p>
      </div>
      <FavorPlusLogo size={26} />
    </div>
  );
}

function PaymentMethod({
  icon,
  title,
  description,
  price,
  message,
  actionLabel,
  pending,
  disabled,
  onAction,
  secondaryAction,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  price: string;
  message: string | null;
  actionLabel: string;
  pending: boolean;
  disabled: boolean;
  onAction: () => void;
  secondaryAction?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface)] text-brand-accent-ink shadow-sm dark:text-brand-accent">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-[var(--foreground)]">{title}</h3>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                {description}
              </p>
            </div>
            <span className="shrink-0 text-xs font-bold text-[var(--foreground)]">
              {price}
            </span>
          </div>
          {message ? (
            <p
              className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]"
              role="status"
            >
              {message}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="accent"
              size="md"
              shape="rounded-full"
              className="min-h-11 flex-1"
              loading={pending}
              disabled={disabled}
              onClick={onAction}
            >
              {actionLabel}
            </Button>
            {secondaryAction}
          </div>
        </div>
      </div>
    </div>
  );
}
