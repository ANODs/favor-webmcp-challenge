import type { ReviewDto } from "@/entities/review";
import type { UserPreviewDto, UserRole } from "@/entities/user";
import type { ContractTitleValidationCode } from "@/shared/config";

export type ContractAuthorDto = UserPreviewDto & {
  role?: UserRole;
  rating?: number;
};

export type ContractTypeDto = "offer" | "order";
export type SupportedEscrowCurrencyDto = "TON" | "USDT";
export type EscrowCurrencyDto = SupportedEscrowCurrencyDto | "USDC";

export type ContractDto = {
  id: number;
  authorId: number;
  title: string;
  titleRu: string | null;
  titleEn: string | null;
  slug: string;
  description: string;
  descriptionRu: string | null;
  descriptionEn: string | null;
  type: ContractTypeDto;
  category: string | null;
  tags: string[];
  basePrice: number | string | null;
  deadlineDays: number | null;
  paymentWindowHours?: number | null;
  maxOpenDeals: number | null;
  status:
    | "pending_moderation"
    | "active"
    | "limit_reached"
    | "rejected"
    | "archived"
    | "unclaimed"
    | "pending_verification";
  moderationComment: string | null;
  aiModerationSummary?: string | null;
  aiRiskFactor?: number | null;
  telegramPostUrl: string | null;
  telegramChannelUrl: string | null;
  cachedTelegramText?: string | null;
  mediaRefs?: string[] | null;
  ogImageBase64?: string | null;
  verificationCode?: string | null;
  scoutedTelegramUsername?: string | null;
  scoutId?: number | null;
  isEscrow: boolean;
  escrowCurrency: EscrowCurrencyDto;
  createdAt: string;
  updatedAt: string;
  author?: ContractAuthorDto | null;
  scout?: ContractAuthorDto | null;
  isRevealed?: boolean;
  uniqueViewsCount?: number;
  completedDealsCount?: number;
  averageRating?: number | null;
  reviewsCount?: number;
  isFavorite?: boolean;
  questionsEnabled?: boolean;
  reviews?: ReviewDto[];
  _count?: {
    deals: number;
  };
};

export type ContractListPageDto = {
  items: ContractDto[];
  nextCursor: string | null;
};

export type ContractFavoriteDto = {
  contractId: number;
  slug: string;
  isFavorite: boolean;
};

export type ContractTitleValidationDto = {
  ok: boolean;
  code?: ContractTitleValidationCode;
};

export type GeneratedSlugDto = {
  ok: boolean;
  slug: string;
  reason?: string;
};

export type TelegramPostTranslationDto = {
  titleRu: string;
  titleEn: string;
  descriptionRu: string;
  descriptionEn: string;
};

export type TelegramPostPreviewDto = {
  telegramPostUrl: string;
  telegramChannelUrl: string;
  description: string;
  images: string[];
  translation?: TelegramPostTranslationDto | null;
};

export type ContractTelegramPostButtonReasonDto =
  | "contract_has_no_telegram_post"
  | "telegram_post_id_is_invalid"
  | "telegram_keyboard_could_not_be_preserved"
  | "telegram_keyboard_is_full"
  | "telegram_channel_access_could_not_be_verified"
  | "telegram_user_cannot_edit_channel"
  | "telegram_bot_access_could_not_be_verified"
  | "telegram_bot_cannot_edit_channel"
  | "telegram_post_cannot_be_edited"
  | "telegram_button_is_invalid"
  | "telegram_caption_is_invalid"
  | "telegram_caption_is_too_long"
  | "telegram_api_rejected_post_edit"
  | "telegram_post_sync_failed";

export type ContractTelegramPostButtonResultDto =
  | { status: "added" | "unchanged" | "link_added" | "link_unchanged" }
  | {
      status: "skipped" | "failed";
      reason: ContractTelegramPostButtonReasonDto;
    };

export type CreateContractDto = {
  titleRu?: string | null;
  titleEn?: string | null;
  descriptionRu?: string | null;
  descriptionEn?: string | null;
  type: ContractTypeDto;
  category?: string | null;
  tags?: string[];
  basePrice?: number | null;
  deadlineDays?: number | null;
  paymentWindowHours?: number | null;
  maxOpenDeals?: number | null;
  telegramPostUrl?: string | null;
  telegramChannelUrl?: string | null;
  cachedTelegramText?: string | null;
  mediaRefs?: string[] | null;
  isScouting?: boolean;
  scoutedTelegramUsername?: string | null;
  isEscrow?: boolean | null;
  escrowCurrency?: SupportedEscrowCurrencyDto | null;
};

export type UpdateContractDto = Partial<CreateContractDto> & {
  contractId: number;
  baseUpdatedAt: string;
};
