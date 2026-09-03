"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { buildProfileStartParam } from "@/shared/lib/telegram/client";
import { useGuestLock } from "@/shared/lib/use-guest-lock";
import { GuestLockDialog } from "@/shared/ui";

import {
  getFavorSubscriptionMode,
  type FavorSubscriptionTarget,
} from "../model/types";
import { useFavorSubscriptionCheckout } from "../model/use-favor-subscription-checkout";
import {
  FavorSubscriptionDialog,
  type FavorSubscriptionDialogStep,
} from "./favor-subscription-dialog";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  payerUserId: number | null;
  target: FavorSubscriptionTarget;
  botUsername: string;
};

export function FavorSubscriptionCheckout({
  isOpen,
  onClose,
  payerUserId,
  target,
  botUsername,
}: Props) {
  const t = useTranslations("FavorSubscription");
  const [step, setStep] = useState<FavorSubscriptionDialogStep>("plans");
  const mode = getFavorSubscriptionMode(payerUserId, target.id);
  const guestLock = useGuestLock(botUsername);
  const checkout = useFavorSubscriptionCheckout({
    isOpen,
    payerUserId,
    target,
  });

  const handleClose = () => {
    setStep("plans");
    checkout.clearMessages();
    onClose();
  };

  const handleContinue = () => {
    if (payerUserId === null) {
      guestLock.handleRequireAuth({
        label:
          mode === "gift"
            ? t("GiftSubscriptionAction")
            : t("BuySubscriptionAction"),
        startApp: buildProfileStartParam(target.slug),
      });
      return;
    }

    setStep("payment");
  };

  return (
    <>
      <FavorSubscriptionDialog
        isOpen={isOpen && !guestLock.isLocked}
        step={step}
        mode={mode}
        target={target}
        offer={checkout.offerQuery.data}
        offerPending={checkout.offerQuery.isPending}
        offerError={checkout.offerQuery.isError}
        selectedDuration={checkout.selectedDuration}
        telegramSubscriptionMessage={checkout.telegramSubscriptionMessage}
        tonSubscriptionMessage={checkout.tonSubscriptionMessage}
        favorSubscriptionMessage={checkout.favorSubscriptionMessage}
        telegramPending={checkout.telegramPending}
        tonPaymentPending={checkout.tonPaymentPending}
        favorPaymentPending={checkout.favorPaymentPending}
        pendingCancellationPending={checkout.pendingCancellationPending}
        checkoutLocked={checkout.checkoutLocked}
        canCancelPendingCheckout={checkout.canCancelPendingCheckout}
        tonWalletConnected={checkout.tonWalletConnected}
        tonConnectionRestored={checkout.tonConnectionRestored}
        onClose={handleClose}
        onBack={() => setStep("plans")}
        onContinue={handleContinue}
        onRetryOffer={() => void checkout.offerQuery.refetch()}
        onSelectDuration={checkout.setSelectedDuration}
        onConnectWallet={checkout.handleConnectWallet}
        onTelegramPay={() => void checkout.handleTelegramPay()}
        onTonPay={(expectedAmountNano) =>
          void checkout.handleTonPay(expectedAmountNano)
        }
        onFavorPay={(expectedAmountNano) =>
          void checkout.handleFavorPay(expectedAmountNano)
        }
        onCancelPendingCheckout={() =>
          void checkout.handleCancelPendingCheckout()
        }
      />

      <GuestLockDialog
        isOpen={isOpen && guestLock.isLocked}
        lockedItemLabel={guestLock.lockedItemLabel}
        telegramContinueUrl={guestLock.telegramContinueUrl}
        onClose={guestLock.closeLock}
      />
    </>
  );
}
