"use client";

import { ReactNode } from "react";
import { TonConnectUIProvider } from "@tonconnect/ui-react";

type Props = {
  children: ReactNode;
  manifestUrl: string;
  telegramBotUsername: string;
};

export function TonConnectProvider({ children, manifestUrl, telegramBotUsername }: Props) {
  return (
    <TonConnectUIProvider
      manifestUrl={manifestUrl}
      actionsConfiguration={{
        twaReturnUrl: `https://t.me/${telegramBotUsername.replace(/^@/, "")}`,
      }}
      uiPreferences={{
        theme: "SYSTEM",
      }}
      language="ru"
      analytics={{
        mode: "off",
      }}
    >
      {children}
    </TonConnectUIProvider>
  );
}
