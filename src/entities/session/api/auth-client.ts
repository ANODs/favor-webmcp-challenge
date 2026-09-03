import { apiRequest, refreshApiSession } from "@/shared/api";
import type { CurrentSessionUserDto } from "@/shared/types/session-user";

export const authClient = {
  getMe() {
    return apiRequest<CurrentSessionUserDto | null>({
      path: "/api/auth/me",
      init: { method: "GET" },
    });
  },
  refreshSession() {
    return refreshApiSession();
  },
  updateSettings(data: { isTelegramUsernameHidden?: boolean; walletAddress?: string | null }) {
    return apiRequest<CurrentSessionUserDto>({
      path: "/api/auth/me/settings",
      init: {
        method: "PATCH",
        body: JSON.stringify(data),
      },
    });
  },
  completeOnboarding() {
    return apiRequest<CurrentSessionUserDto>({
      path: "/api/auth/me/onboarding",
      init: {
        method: "PATCH",
        body: JSON.stringify({}),
      },
    });
  },
  syncTelegramProfile(initData: string) {
    return apiRequest<CurrentSessionUserDto>({
      path: "/api/auth/telegram",
      init: {
        method: "POST",
        body: JSON.stringify({ initData }),
      },
    });
  },
};
