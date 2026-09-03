import type {
  CurrentSessionUserDto,
  SessionUserRole,
} from "@/shared/types/session-user";

export type UserRole = SessionUserRole;

export type UserPreviewDto = {
  id: number;
  name: string | null;
  telegramId?: string;
  telegramUsername: string | null;
  walletAddress?: string | null;
};

export type UserDto = CurrentSessionUserDto;
