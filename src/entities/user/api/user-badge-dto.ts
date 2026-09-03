import type {
  UserBadgeIconKey,
  UserBadgeTone,
} from "../model/user-badges";

export type UserBadgeDto = {
  id: number;
  code: string;
  labelRu: string;
  labelEn: string;
  descriptionRu: string;
  descriptionEn: string;
  iconKey: UserBadgeIconKey;
  tone: UserBadgeTone;
  sortOrder: number;
};

export type UserBadgeCatalogPageDto = {
  items: UserBadgeDto[];
  nextCursor: string | null;
};

export type CreateUserBadgePayload = {
  labelRu: string;
  labelEn: string;
  descriptionRu: string;
  descriptionEn: string;
  iconKey: UserBadgeIconKey;
  tone: UserBadgeTone;
  sortOrder?: number;
};
