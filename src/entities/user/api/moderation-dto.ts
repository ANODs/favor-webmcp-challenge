import type { AccountRestrictionScope } from "@prisma/client";

import type { UserBadgeDto } from "./user-badge-dto";

export type AccountRestrictionDto = {
  id: number;
  scope: AccountRestrictionScope;
  reasonCode: string;
  publicMessage: string;
  internalComment: string | null;
  source: "manual" | "automatic";
  expiresAt: string | null;
  createdAt: string;
  createdByModerator: {
    id: number;
    name: string | null;
    telegramUsername: string | null;
  } | null;
};

export type ModeratedUserDto = {
  id: number;
  role: "customer" | "freelancer" | "moderator";
  telegramId: string;
  telegramUsername: string | null;
  isTelegramUsernameHidden: boolean;
  name: string | null;
  isPremium: boolean;
  telegramPremium: boolean;
  telegramLevel: number | null;
  createdAt: string;
  badges: UserBadgeDto[];
  accountRestrictions: AccountRestrictionDto[];
  _count: {
    contracts: number;
    customerDeals: number;
    freelancerDeals: number;
    supportTickets: number;
  };
};

export type ModeratedUsersPageDto = {
  items: ModeratedUserDto[];
  nextCursor: string | null;
};

export type CreateAccountRestrictionPayload = {
  scope: AccountRestrictionScope;
  reasonCode: string;
  publicMessage: string;
  internalComment?: string | null;
  expiresInHours?: number | null;
};
