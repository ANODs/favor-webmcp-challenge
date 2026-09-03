"use client";

import {
  useIsConnectionRestored,
  useTonConnectUI,
  useTonWallet,
} from "@tonconnect/ui-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { sessionQueryKeys } from "@/entities/session";
import {
  FAVOR_SUBSCRIPTION_DURATION,
  MONTHLY_SUBSCRIPTION_DURATION,
  SUBSCRIPTION_QUOTE_CHANGED_CODE,
  SUBSCRIPTION_PAYMENT_STATUS,
} from "@/entities/subscription";
import { userQueryKeys } from "@/entities/user";
import { ApiRequestError } from "@/shared/api";
import {
  openTelegramInvoice,
  triggerTelegramImpact,
  triggerTelegramNotification,
} from "@/shared/lib/telegram/client";
import {
  buildJettonTransferPayload,
  buildTonSubscriptionPayload,
  FAVOR_JETTON_TRANSFER_GAS_NANO,
} from "@/shared/lib/ton";

import { subscriptionClient } from "../api/subscription-client";
import {
  clearPendingFavorSubscription,
  getPendingFavorSubscription,
  savePendingFavorSubscription,
  usePendingFavorSubscription,
} from "./pending-subscription";
import type {
  FavorSubscriptionDuration,
  FavorSubscriptionTarget,
} from "./types";
import { useFavorSubscriptionOffer } from "./use-favor-subscription-offer";

type CheckoutParams = {
  isOpen: boolean;
  payerUserId: number | null;
  target: FavorSubscriptionTarget;
};

const PENDING_SUBSCRIPTION_RETRY_MS = 5_000;

export function useFavorSubscriptionCheckout({
  isOpen,
  payerUserId,
  target,
}: CheckoutParams) {
  const locale = useLocale() as "ru" | "en";
  const t = useTranslations("FavorSubscription");
  const queryClient = useQueryClient();
  const [tonConnectUI] = useTonConnectUI();
  const tonWallet = useTonWallet();
  const tonConnectionRestored = useIsConnectionRestored();
  const offerQuery = useFavorSubscriptionOffer(isOpen);
  const refetchOffer = offerQuery.refetch;
  const pendingCheckout = usePendingFavorSubscription();
  const [selectedDuration, setSelectedDuration] =
    useState<FavorSubscriptionDuration>(MONTHLY_SUBSCRIPTION_DURATION);
  const [telegramSubscriptionMessage, setTelegramSubscriptionMessage] =
    useState<string | null>(null);
  const [tonSubscriptionMessage, setTonSubscriptionMessage] = useState<
    string | null
  >(null);
  const [favorSubscriptionMessage, setFavorSubscriptionMessage] = useState<
    string | null
  >(null);
  const [telegramPending, setTelegramPending] = useState(false);
  const [tonPaymentPending, setTonPaymentPending] = useState(false);
  const [favorPaymentPending, setFavorPaymentPending] = useState(false);
  const [pendingCancellationPending, setPendingCancellationPending] =
    useState(false);
  const [checkoutPreparationPending, setCheckoutPreparationPending] =
    useState(false);
  const refreshTimerRef = useRef<number | null>(null);
  const confirmingIntentRef = useRef<string | null>(null);
  const checkoutPreparationRef = useRef(false);
  const checkoutLocked = Boolean(pendingCheckout) || checkoutPreparationPending;

  const clearMessages = useCallback(() => {
    setTelegramSubscriptionMessage(null);
    setTonSubscriptionMessage(null);
    setFavorSubscriptionMessage(null);
  }, []);

  const refreshSubscriptionState = useCallback(
    async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: sessionQueryKeys.currentUser,
        }),
        queryClient.invalidateQueries({
          queryKey: userQueryKeys.profiles,
        }),
      ]);

      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
      }

      refreshTimerRef.current = window.setTimeout(() => {
        refreshTimerRef.current = null;
        void Promise.all([
          queryClient.invalidateQueries({
            queryKey: sessionQueryKeys.currentUser,
          }),
          queryClient.invalidateQueries({
            queryKey: userQueryKeys.profiles,
          }),
        ]);
      }, 1_500);
    },
    [queryClient],
  );

  useEffect(
    () => () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
      }
    },
    [],
  );

  const acquireCheckoutPreparationLock = useCallback(() => {
    if (checkoutPreparationRef.current || getPendingFavorSubscription()) {
      return false;
    }

    checkoutPreparationRef.current = true;
    setCheckoutPreparationPending(true);
    return true;
  }, []);

  const releaseCheckoutPreparationLock = useCallback(() => {
    checkoutPreparationRef.current = false;
    setCheckoutPreparationPending(false);
  }, []);

  const prepareWithCrossTabLock = useCallback(
    async <T,>(operation: () => Promise<T>): Promise<T | null> => {
      const runIfAvailable = async () => {
        if (getPendingFavorSubscription()) return null;
        return operation();
      };

      if (!("locks" in navigator)) {
        return runIfAvailable();
      }

      return navigator.locks.request(
        `favor-subscription-checkout:${payerUserId ?? "guest"}`,
        runIfAvailable,
      );
    },
    [payerUserId],
  );

  const getSuccessMessage = useCallback(
    (provider: "favor" | "stars" | "ton", recipientId: number, name: string) => {
      const isGift = recipientId !== payerUserId;
      const key = isGift
        ? provider === "favor"
          ? "FavorGiftSuccess"
          : provider === "ton"
            ? "TonGiftSuccess"
            : "StarsGiftSuccess"
        : provider === "favor"
          ? "FavorSuccess"
          : provider === "ton"
            ? "TonSuccess"
            : "PaymentSuccess";

      return t(key, { name });
    },
    [payerUserId, t],
  );

  const checkAndConfirmPendingSubscription = useCallback(async ({
    announcePending = false,
  }: {
    announcePending?: boolean;
  } = {}) => {
    const pending = getPendingFavorSubscription();
    if (!pending) {
      if (pendingCheckout) clearPendingFavorSubscription();
      return false;
    }
    if (payerUserId === null) return false;

    if (pending.payerUserId !== payerUserId) {
      clearPendingFavorSubscription(pending.paymentIntentId);
      return false;
    }

    if (confirmingIntentRef.current === pending.paymentIntentId) {
      return false;
    }

    confirmingIntentRef.current = pending.paymentIntentId;

    try {
      if (pending.provider === "stars") {
        if (announcePending) {
          setTelegramPending(true);
          setTelegramSubscriptionMessage(t("Checking"));
        }
        const intentStatus = await subscriptionClient.getIntentStatus(
          pending.paymentIntentId,
        );
        if (
          getPendingFavorSubscription()?.paymentIntentId !==
          pending.paymentIntentId
        ) {
          return false;
        }

        if (
          intentStatus.activated &&
          intentStatus.status === SUBSCRIPTION_PAYMENT_STATUS.confirmed
        ) {
          clearPendingFavorSubscription(pending.paymentIntentId);
          setTelegramSubscriptionMessage(
            getSuccessMessage(
              "stars",
              intentStatus.recipientUserId,
              pending.recipient.displayName,
            ),
          );
          triggerTelegramNotification("success");
          await refreshSubscriptionState();
          return true;
        }

        if (intentStatus.terminal) {
          clearPendingFavorSubscription(pending.paymentIntentId);
          setTelegramSubscriptionMessage(t("PaymentFailed"));
          triggerTelegramNotification("error");
          return false;
        }

        if (announcePending) {
          setTelegramSubscriptionMessage(t("PaymentPending"));
        }
        return false;
      }

      const pendingBoc = pending.boc;
      if (!pendingBoc) {
        const result = await subscriptionClient.reconcileIntent(
          pending.paymentIntentId,
        );

        if (result.activated) {
          clearPendingFavorSubscription(pending.paymentIntentId);
          if (pending.provider === "favor") {
            setFavorSubscriptionMessage(
              getSuccessMessage(
                "favor",
                result.recipientUserId,
                pending.recipient.displayName,
              ),
            );
          } else {
            setTonSubscriptionMessage(
              getSuccessMessage(
                "ton",
                result.recipientUserId,
                pending.recipient.displayName,
              ),
            );
          }
          triggerTelegramNotification("success");
          await refreshSubscriptionState();
          return true;
        }

        if (result.terminal) {
          clearPendingFavorSubscription(pending.paymentIntentId);
          if (pending.provider === "favor") {
            setFavorSubscriptionMessage(t("FavorFailed"));
          } else {
            setTonSubscriptionMessage(t("TonFailed"));
          }
          triggerTelegramNotification("error");
        }

        return false;
      }

      if (pending.provider === "favor") {
        if (announcePending) {
          setFavorPaymentPending(true);
          setFavorSubscriptionMessage(t("VerifyingFavorBurn"));
        }
        const result = await subscriptionClient.confirmFavorPayment({
          paymentIntentId: pending.paymentIntentId,
          boc: pendingBoc,
        });

        if (!result.activated) return false;

        clearPendingFavorSubscription(pending.paymentIntentId);
        setFavorSubscriptionMessage(
          getSuccessMessage(
            "favor",
            pending.recipient.id,
            pending.recipient.displayName,
          ),
        );
      } else {
        if (announcePending) {
          setTonPaymentPending(true);
          setTonSubscriptionMessage(t("TonSent"));
        }
        const result = await subscriptionClient.confirmTonPayment({
          paymentIntentId: pending.paymentIntentId,
          boc: pendingBoc,
          reference: pending.reference,
        });

        if (!result.activated) return false;

        clearPendingFavorSubscription(pending.paymentIntentId);
        setTonSubscriptionMessage(
          getSuccessMessage(
            "ton",
            pending.recipient.id,
            pending.recipient.displayName,
          ),
        );
      }

      triggerTelegramNotification("success");
      await refreshSubscriptionState();
      return true;
    } catch {
      // The chain/indexer can lag behind the wallet. Keep the intent for a retry.
      if (pending.provider === "stars" && announcePending) {
        setTelegramSubscriptionMessage(t("PaymentPending"));
      }
      return false;
    } finally {
      confirmingIntentRef.current = null;
      if (announcePending) {
        if (pending.provider === "stars") setTelegramPending(false);
        if (pending.provider === "favor") setFavorPaymentPending(false);
        if (pending.provider === "ton") setTonPaymentPending(false);
      }
    }
  }, [
    getSuccessMessage,
    payerUserId,
    pendingCheckout,
    refreshSubscriptionState,
    t,
  ]);

  const handleCancelPendingCheckout = useCallback(async () => {
    const pending = getPendingFavorSubscription();
    if (
      !pending ||
      pending.provider !== "stars" ||
      pending.payerUserId !== payerUserId
    ) {
      return;
    }

    setPendingCancellationPending(true);
    setTelegramSubscriptionMessage(t("Checking"));

    try {
      const result = await subscriptionClient.cancelIntent(
        pending.paymentIntentId,
      );
      if (
        getPendingFavorSubscription()?.paymentIntentId !==
        pending.paymentIntentId
      ) {
        return;
      }

      if (result.status === SUBSCRIPTION_PAYMENT_STATUS.confirmed) {
        await checkAndConfirmPendingSubscription({ announcePending: true });
        return;
      }

      if (result.canceled) {
        clearPendingFavorSubscription(pending.paymentIntentId);
        setTelegramSubscriptionMessage(t("PaymentCancelled"));
        return;
      }

      setTelegramSubscriptionMessage(t("PaymentPending"));
    } catch {
      setTelegramSubscriptionMessage(t("PaymentPending"));
    } finally {
      setPendingCancellationPending(false);
    }
  }, [checkAndConfirmPendingSubscription, payerUserId, t]);

  useEffect(() => {
    const handleForeground = () => {
      if (document.visibilityState === "visible") {
        void checkAndConfirmPendingSubscription();
      }
    };

    const initialCheck = window.setTimeout(() => {
      void checkAndConfirmPendingSubscription();
    }, 0);
    const retryInterval = window.setInterval(() => {
      void checkAndConfirmPendingSubscription();
    }, PENDING_SUBSCRIPTION_RETRY_MS);

    document.addEventListener("visibilitychange", handleForeground);
    window.addEventListener("focus", handleForeground);

    return () => {
      window.clearTimeout(initialCheck);
      window.clearInterval(retryInterval);
      document.removeEventListener("visibilitychange", handleForeground);
      window.removeEventListener("focus", handleForeground);
    };
  }, [checkAndConfirmPendingSubscription]);

  const handleTelegramPay = useCallback(async () => {
    if (payerUserId === null || !acquireCheckoutPreparationLock()) return;

    clearMessages();
    setTelegramPending(true);
    let preparedIntentId: string | null = null;

    try {
      const preparation = await prepareWithCrossTabLock(async () => {
        const checkoutAttemptId = crypto.randomUUID();
        const prepared = await subscriptionClient.createInvoice({
          duration: selectedDuration,
          locale,
          recipientUserId: target.id,
          checkoutAttemptId,
        });
        preparedIntentId = prepared.paymentIntentId;

        if (!prepared.invoiceLink) {
          throw new Error("TELEGRAM_INVOICE_LINK_MISSING");
        }

        const persisted = savePendingFavorSubscription({
          provider: "stars",
          payerUserId,
          recipient: {
            id: target.id,
            slug: target.slug,
            displayName: target.displayName,
          },
          checkoutAttemptId,
          paymentIntentId: prepared.paymentIntentId,
          expiresAt: prepared.expiresAt,
        });
        if (!persisted) {
          throw new Error("PENDING_CHECKOUT_STORAGE_UNAVAILABLE");
        }

        return { ...prepared, invoiceLink: prepared.invoiceLink };
      });
      if (!preparation) return;
      const prepared = preparation;

      setTelegramSubscriptionMessage(t("InvoiceOpened"));
      openTelegramInvoice(prepared.invoiceLink, (status) => {
        const currentPending = getPendingFavorSubscription();
        if (currentPending?.paymentIntentId !== prepared.paymentIntentId) return;

        if (status === "cancelled" || status === "failed") {
          setTelegramPending(true);
          setTelegramSubscriptionMessage(t("Checking"));
          void subscriptionClient
            .cancelIntent(prepared.paymentIntentId)
            .then(async (result) => {
              if (
                getPendingFavorSubscription()?.paymentIntentId !==
                prepared.paymentIntentId
              ) {
                return;
              }

              if (result.status === SUBSCRIPTION_PAYMENT_STATUS.confirmed) {
                await checkAndConfirmPendingSubscription({
                  announcePending: true,
                });
                return;
              }

              if (result.canceled) {
                clearPendingFavorSubscription(prepared.paymentIntentId);
                setTelegramSubscriptionMessage(
                  status === "cancelled"
                    ? t("PaymentCancelled")
                    : t("PaymentFailed"),
                );
                if (status === "failed") {
                  triggerTelegramNotification("error");
                }
                return;
              }

              setTelegramSubscriptionMessage(t("PaymentPending"));
            })
            .catch(() => {
              setTelegramSubscriptionMessage(t("PaymentPending"));
            })
            .finally(() => setTelegramPending(false));
          return;
        }

        if (status === "paid" || status === "pending") {
          setTelegramSubscriptionMessage(
            status === "paid" ? t("Checking") : t("PaymentPending"),
          );
          void checkAndConfirmPendingSubscription({ announcePending: true });
        }
      });
      // Browser fallback has no Telegram callback, so status polling starts here.
      void checkAndConfirmPendingSubscription({ announcePending: true });
    } catch {
      if (preparedIntentId) {
        clearPendingFavorSubscription(preparedIntentId);
      }
      setTelegramSubscriptionMessage(t("CreateInvoiceFailed"));
      triggerTelegramNotification("error");
    } finally {
      setTelegramPending(false);
      releaseCheckoutPreparationLock();
    }
  }, [
    acquireCheckoutPreparationLock,
    checkAndConfirmPendingSubscription,
    clearMessages,
    locale,
    payerUserId,
    prepareWithCrossTabLock,
    releaseCheckoutPreparationLock,
    selectedDuration,
    t,
    target,
  ]);

  const handleTonPay = useCallback(async (expectedAmountNano: string) => {
    if (payerUserId === null) return;
    if (!tonConnectionRestored) {
      setTonSubscriptionMessage(t("WaitTonRestoration"));
      return;
    }
    if (!tonWallet) {
      setTonSubscriptionMessage(t("ConnectTonFirst"));
      return;
    }
    if (!acquireCheckoutPreparationLock()) return;

    clearMessages();
    setTonPaymentPending(true);
    setTonSubscriptionMessage(t("PrepareTon"));
    let transactionSubmitted = false;
    let preparedIntentId: string | null = null;

    try {
      const preparation = await prepareWithCrossTabLock(async () => {
        const checkoutAttemptId = crypto.randomUUID();
        const prepared = await subscriptionClient.prepareTonPayment({
          duration: selectedDuration,
          expectedAmountNano,
          userWalletAddress: tonWallet.account.address,
          recipientUserId: target.id,
          checkoutAttemptId,
        });
        preparedIntentId = prepared.paymentIntentId;

        if (
          !prepared.recipientAddress ||
          !prepared.amountNano ||
          prepared.amountNano !== expectedAmountNano ||
          !prepared.reference ||
          !prepared.paymentIntentId
        ) {
          throw new Error(t("TonMissingData"));
        }

        const pending = {
          provider: "ton" as const,
          payerUserId,
          recipient: {
            id: target.id,
            slug: target.slug,
            displayName: target.displayName,
          },
          checkoutAttemptId,
          paymentIntentId: prepared.paymentIntentId,
          expiresAt: prepared.expiresAt,
          reference: prepared.reference,
        };
        if (!savePendingFavorSubscription(pending)) {
          throw new Error("PENDING_CHECKOUT_STORAGE_UNAVAILABLE");
        }

        return {
          pending,
          prepared: {
            ...prepared,
            amountNano: prepared.amountNano,
            recipientAddress: prepared.recipientAddress,
            reference: prepared.reference,
          },
        };
      });
      if (!preparation) return;
      const { pending, prepared } = preparation;

      setTonSubscriptionMessage(t("ConfirmTon"));
      const transaction = await tonConnectUI.sendTransaction({
        validUntil: (prepared.serverTime ?? Math.floor(Date.now() / 1000)) + 300,
        messages: [
          {
            address: prepared.recipientAddress,
            amount: prepared.amountNano,
            payload: buildTonSubscriptionPayload(prepared.reference),
          },
        ],
      });
      transactionSubmitted = true;
      const bocPersisted = savePendingFavorSubscription({
        ...pending,
        boc: transaction.boc,
      });
      setTonSubscriptionMessage(t("TonSent"));
      if (bocPersisted) {
        await checkAndConfirmPendingSubscription({ announcePending: true });
      } else {
        const result = await subscriptionClient.confirmTonPayment({
          paymentIntentId: prepared.paymentIntentId,
          boc: transaction.boc,
          reference: prepared.reference,
        });
        if (result.activated) {
          clearPendingFavorSubscription(prepared.paymentIntentId);
          setTonSubscriptionMessage(
            getSuccessMessage("ton", target.id, target.displayName),
          );
          triggerTelegramNotification("success");
          await refreshSubscriptionState();
        }
      }
    } catch (error) {
      if (!transactionSubmitted && preparedIntentId) {
        clearPendingFavorSubscription(preparedIntentId);
      }
      if (
        error instanceof ApiRequestError &&
        error.code === SUBSCRIPTION_QUOTE_CHANGED_CODE
      ) {
        const refreshedOffer = await refetchOffer();
        setTonSubscriptionMessage(
          refreshedOffer.isError ? t("OfferLoadError") : t("QuoteChanged"),
        );
        return;
      }
      setTonSubscriptionMessage(
        transactionSubmitted ? t("TonSent") : t("TonFailed"),
      );
      if (!transactionSubmitted) triggerTelegramNotification("error");
    } finally {
      setTonPaymentPending(false);
      releaseCheckoutPreparationLock();
    }
  }, [
    acquireCheckoutPreparationLock,
    checkAndConfirmPendingSubscription,
    clearMessages,
    getSuccessMessage,
    payerUserId,
    prepareWithCrossTabLock,
    refreshSubscriptionState,
    refetchOffer,
    releaseCheckoutPreparationLock,
    selectedDuration,
    t,
    target,
    tonConnectUI,
    tonConnectionRestored,
    tonWallet,
  ]);

  const handleFavorPay = useCallback(async (expectedAmountNano: string) => {
    if (
      payerUserId === null ||
      selectedDuration !== FAVOR_SUBSCRIPTION_DURATION
    ) {
      return;
    }
    if (!tonConnectionRestored) {
      setFavorSubscriptionMessage(t("WaitTonRestoration"));
      return;
    }
    if (!tonWallet?.account.address) {
      setFavorSubscriptionMessage(t("ConnectTonFirst"));
      return;
    }
    if (!acquireCheckoutPreparationLock()) return;

    clearMessages();
    setFavorPaymentPending(true);
    setFavorSubscriptionMessage(t("PrepareFavor"));
    let transactionSubmitted = false;
    let preparedIntentId: string | null = null;

    try {
      const preparation = await prepareWithCrossTabLock(async () => {
        const checkoutAttemptId = crypto.randomUUID();
        const prepared = await subscriptionClient.prepareFavorPayment({
          duration: FAVOR_SUBSCRIPTION_DURATION,
          expectedAmountNano,
          userWalletAddress: tonWallet.account.address,
          recipientUserId: target.id,
          checkoutAttemptId,
        });
        preparedIntentId = prepared.paymentIntentId;

        if (
          !prepared.recipientAddress ||
          !prepared.userJettonWalletAddress ||
          !prepared.amountNano ||
          prepared.amountNano !== expectedAmountNano ||
          !prepared.reference ||
          !prepared.paymentIntentId
        ) {
          throw new Error(t("FavorMissingData"));
        }

        const pending = {
          provider: "favor" as const,
          payerUserId,
          recipient: {
            id: target.id,
            slug: target.slug,
            displayName: target.displayName,
          },
          checkoutAttemptId,
          paymentIntentId: prepared.paymentIntentId,
          expiresAt: prepared.expiresAt,
          reference: prepared.reference,
        };
        if (!savePendingFavorSubscription(pending)) {
          throw new Error("PENDING_CHECKOUT_STORAGE_UNAVAILABLE");
        }

        return {
          pending,
          prepared: {
            ...prepared,
            amountNano: prepared.amountNano,
            recipientAddress: prepared.recipientAddress,
            reference: prepared.reference,
            userJettonWalletAddress: prepared.userJettonWalletAddress,
          },
        };
      });
      if (!preparation) return;
      const { pending, prepared } = preparation;

      const payload = buildJettonTransferPayload({
        amount: BigInt(prepared.amountNano),
        recipientAddress: prepared.recipientAddress,
        responseAddress: tonWallet.account.address,
        reference: prepared.reference,
      });

      setFavorSubscriptionMessage(t("ConfirmFavor"));
      const transaction = await tonConnectUI.sendTransaction({
        validUntil: (prepared.serverTime ?? Math.floor(Date.now() / 1000)) + 300,
        messages: [
          {
            address: prepared.userJettonWalletAddress,
            amount: FAVOR_JETTON_TRANSFER_GAS_NANO,
            payload,
          },
        ],
      });
      transactionSubmitted = true;
      const bocPersisted = savePendingFavorSubscription({
        ...pending,
        boc: transaction.boc,
      });
      setFavorSubscriptionMessage(t("VerifyingFavorBurn"));
      if (bocPersisted) {
        await checkAndConfirmPendingSubscription({ announcePending: true });
      } else {
        const result = await subscriptionClient.confirmFavorPayment({
          paymentIntentId: prepared.paymentIntentId,
          boc: transaction.boc,
        });
        if (result.activated) {
          clearPendingFavorSubscription(prepared.paymentIntentId);
          setFavorSubscriptionMessage(
            getSuccessMessage("favor", target.id, target.displayName),
          );
          triggerTelegramNotification("success");
          await refreshSubscriptionState();
        }
      }
    } catch (error) {
      if (!transactionSubmitted && preparedIntentId) {
        clearPendingFavorSubscription(preparedIntentId);
      }
      if (
        error instanceof ApiRequestError &&
        error.code === SUBSCRIPTION_QUOTE_CHANGED_CODE
      ) {
        const refreshedOffer = await refetchOffer();
        setFavorSubscriptionMessage(
          refreshedOffer.isError ? t("OfferLoadError") : t("QuoteChanged"),
        );
        return;
      }
      setFavorSubscriptionMessage(
        transactionSubmitted ? t("VerifyingFavorBurn") : t("FavorFailed"),
      );
      if (!transactionSubmitted) triggerTelegramNotification("error");
    } finally {
      setFavorPaymentPending(false);
      releaseCheckoutPreparationLock();
    }
  }, [
    acquireCheckoutPreparationLock,
    checkAndConfirmPendingSubscription,
    clearMessages,
    getSuccessMessage,
    payerUserId,
    prepareWithCrossTabLock,
    refreshSubscriptionState,
    refetchOffer,
    releaseCheckoutPreparationLock,
    selectedDuration,
    t,
    target,
    tonConnectUI,
    tonConnectionRestored,
    tonWallet,
  ]);

  const handleConnectWallet = useCallback(() => {
    if (checkoutPreparationRef.current || getPendingFavorSubscription()) return;

    triggerTelegramImpact("light");
    void tonConnectUI.openModal();
  }, [tonConnectUI]);

  return {
    offerQuery,
    selectedDuration,
    setSelectedDuration,
    telegramSubscriptionMessage,
    tonSubscriptionMessage,
    favorSubscriptionMessage,
    telegramPending,
    tonPaymentPending,
    favorPaymentPending,
    pendingCancellationPending,
    checkoutLocked,
    canCancelPendingCheckout: pendingCheckout?.provider === "stars",
    tonWalletConnected: Boolean(tonWallet),
    tonConnectionRestored,
    clearMessages,
    handleConnectWallet,
    handleTelegramPay,
    handleTonPay,
    handleFavorPay,
    handleCancelPendingCheckout,
  };
}
