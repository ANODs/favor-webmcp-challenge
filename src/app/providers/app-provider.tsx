import { ReactNode } from "react";

import { AppQueryProvider } from "@/app/providers/query-client";
import { SessionKeepAlive } from "@/features/session-keep-alive";
import { ThemeProvider } from "@/app/providers/theme-provider";
import { TonConnectProvider } from "@/app/providers/ton-connect-provider";
import { WalletSync } from "@/app/providers/wallet-sync";
import { ErrorFeedbackProvider } from "@/features/report-problem";
import { TelegramBackButton } from "@/shared/ui/telegram-back-button";
import { GlobalHapticFeedback } from "@/shared/ui/global-haptic-feedback";
import { TelegramSettingsButton } from "@/shared/ui/telegram-settings-button";
import { FavorWebMcpTools } from "./webmcp-tools";

type Props = {
  children: ReactNode;
  tonManifestUrl: string;
  telegramBotUsername: string;
};

export function AppProvider({ children, tonManifestUrl, telegramBotUsername }: Props) {
  return (
    <AppQueryProvider>
      <FavorWebMcpTools />
      <SessionKeepAlive />
      <ThemeProvider>
        <TonConnectProvider
          manifestUrl={tonManifestUrl}
          telegramBotUsername={telegramBotUsername}
        >
          <ErrorFeedbackProvider>
            <WalletSync />
            <GlobalHapticFeedback />
            <TelegramBackButton />
            <TelegramSettingsButton />
            {children}
          </ErrorFeedbackProvider>
        </TonConnectProvider>
      </ThemeProvider>
    </AppQueryProvider>
  );
}
