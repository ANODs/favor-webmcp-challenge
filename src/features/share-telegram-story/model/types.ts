export type TelegramStoryLocale = "ru" | "en";
export type TelegramStoryTheme = "light" | "dark";

type StoryTargetBase = {
  url: string;
};

export type ContractStoryTarget = StoryTargetBase & {
  type: "contract";
  title: string;
  description: string;
  imageUrl?: string | null;
  /** Localized label to render. Prefer this over the legacy raw category value. */
  categoryLabel?: string | null;
  /** @deprecated Pass categoryLabel from the composing layer. */
  category?: string | null;
  tags: string[];
  price?: string | null;
  currency: string;
  deadlineDays?: number | null;
  openDealsCount: number;
  completedDealsCount: number;
  viewsCount: number;
  rating?: number | null;
};

export type ProfileStoryTarget = StoryTargetBase & {
  type: "profile";
  displayName: string;
  telegramUsername?: string | null;
  avatarUrl?: string | null;
  rating: number;
  completedDealsCount: number;
  contractsCount: number;
};

export type ReferralStoryTarget = StoryTargetBase & {
  type: "referral";
  stats?: {
    usersCount: number;
    activeContractsCount: number;
    completedDealsCount: number;
  };
};

export type TelegramStoryTarget =
  | ContractStoryTarget
  | ProfileStoryTarget
  | ReferralStoryTarget;

export type TelegramStoryProgress = {
  phase: "audio" | "render" | "upload";
  value: number;
};
