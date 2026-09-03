export type SessionUserRole = "customer" | "freelancer" | "moderator";

export type CurrentSessionUserDto = {
  id: number;
  name: string | null;
  role: SessionUserRole;
  telegramId: string;
  telegramUsername: string | null;
  telegramFirstName: string | null;
  telegramLastName: string | null;
  avatarUrl?: string | null;
  telegramPremium: boolean;
  telegramLevel: number | null;
  isPremium: boolean;
  premiumExpiresAt: string | null;
  onboardingVersion: number;
  adBalance: number;
  rating?: number;
  isTelegramUsernameHidden: boolean;
  walletAddress: string | null;
  accountRestrictions?: Array<{
    id: number;
    scope:
      | "all_writes"
      | "contract_publish"
      | "deal_create"
      | "communication"
      | "support"
      | "login_lock";
    publicMessage: string;
    reasonCode: string;
    expiresAt: string | null;
  }>;
};
