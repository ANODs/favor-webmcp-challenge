"use client";

import { useEffect, useRef } from "react";
import { TonConnectButton, useIsConnectionRestored, useTonAddress, useTonWallet } from "@tonconnect/ui-react";
import { useTranslations } from "next-intl";

import { ActionCard, ActionCardInset } from "@/shared/ui/action-card";

export function TonWalletWidget() {
  const tonConnectContainerRef = useRef<HTMLDivElement | null>(null);
  const tonWallet = useTonWallet();
  const tonWalletAddress = useTonAddress();
  const tonConnectionRestored = useIsConnectionRestored();
  const t = useTranslations("Settings");

  const connectionLabel = !tonConnectionRestored
    ? t("TonRestoring")
    : tonWallet
      ? t("TonConnected")
      : t("TonNotConnected");

  useEffect(() => {
    const root = tonConnectContainerRef.current;
    if (!root) {
      return;
    }

    const applyTonButtonLayout = () => {
      const tonConnectRoot = root.querySelector<HTMLElement>("#ton-connect-button");
      if (!tonConnectRoot) {
        return false;
      }

      tonConnectRoot.style.width = "100%";
      tonConnectRoot.style.maxWidth = "100%";
      tonConnectRoot.style.display = "block";

      const immediateWrapper = tonConnectRoot.firstElementChild as HTMLElement | null;
      if (immediateWrapper) {
        immediateWrapper.style.width = "100%";
        immediateWrapper.style.maxWidth = "100%";
      }

      const connectButton = tonConnectRoot.querySelector<HTMLElement>('button[data-tc-button="true"]');
      if (connectButton) {
        connectButton.style.width = "100%";
        connectButton.style.maxWidth = "100%";
        connectButton.style.display = "flex";
        connectButton.style.justifyContent = "center";
      }

      return true;
    };

    if (applyTonButtonLayout()) {
      return;
    }

    const observer = new MutationObserver(() => {
      if (applyTonButtonLayout()) {
        observer.disconnect();
      }
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class"],
    });

    return () => observer.disconnect();
  }, [tonConnectionRestored, tonWallet]);

  return (
    <ActionCard
      title={t("TonWalletTitle")}>
      <ActionCardInset className="border border-zinc-200 bg-transparent">
        <p className="text-sm font-medium text-zinc-950">{connectionLabel}</p>
        <p className="mt-2 break-all text-sm leading-6 text-zinc-600">
          {tonWalletAddress || t("TonAddressPlaceholder")}
        </p>
      </ActionCardInset>

      <div ref={tonConnectContainerRef} className="mt-4 w-full">
        <TonConnectButton className="w-full" />
      </div>
    </ActionCard>
  );
}
