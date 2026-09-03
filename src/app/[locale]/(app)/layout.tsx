import { ReactNode } from "react";

import { env } from "@/shared/config";
import { AccountRestrictionBanner } from "@/widgets/account-restriction-banner";
import { BottomNavigation } from "@/widgets/bottom-navigation";

type Props = {
  children: ReactNode;
};

export default function AppLayout({ children }: Props) {
  return (
    <div className="theme-shell min-h-screen">
      <div className="mx-auto flex min-h-screen w-full justify-center lg:flex-row">
        <BottomNavigation botUsername={env.telegramBotUsername} />
        <div className="min-w-0 w-full max-w-6xl pb-20 lg:pb-0">
          <AccountRestrictionBanner />
          {children}
        </div>
      </div>
    </div>
  );
}
