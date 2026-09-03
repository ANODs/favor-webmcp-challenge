import type {
  AccountRestrictionDto,
  CreateUserBadgePayload,
  CreateAccountRestrictionPayload,
  ModeratedUsersPageDto,
  UserBadgeCatalogPageDto,
  UserBadgeDto,
} from "@/entities/user";
import { apiRequest } from "@/shared/api";

export const accountModerationClient = {
  getUsers(query: string, cursor?: string | null) {
    const params = new URLSearchParams();
    if (query.trim()) {
      params.set("q", query.trim());
    }
    if (cursor) {
      params.set("cursor", cursor);
    }

    const search = params.toString();
    return apiRequest<ModeratedUsersPageDto>({
      path: `/api/moderation/users${search ? `?${search}` : ""}`,
      init: { method: "GET" },
    });
  },
  getBadges(cursor?: string | null) {
    const params = new URLSearchParams();
    if (cursor) {
      params.set("cursor", cursor);
    }

    const search = params.toString();
    return apiRequest<UserBadgeCatalogPageDto>({
      path: `/api/moderation/badges${search ? `?${search}` : ""}`,
      init: { method: "GET" },
    });
  },
  createBadge(payload: CreateUserBadgePayload) {
    return apiRequest<UserBadgeDto>({
      path: "/api/moderation/badges",
      init: {
        method: "POST",
        body: JSON.stringify(payload),
      },
    });
  },
  createAndAssignBadge(userId: number, payload: CreateUserBadgePayload) {
    return apiRequest<UserBadgeDto>({
      path: "/api/moderation/badges",
      init: {
        method: "POST",
        body: JSON.stringify({ ...payload, targetUserId: userId }),
      },
    });
  },
  assignBadge(userId: number, badgeId: number) {
    return apiRequest<UserBadgeDto>({
      path: `/api/moderation/users/${userId}/badges/${badgeId}`,
      init: { method: "PUT" },
    });
  },
  removeBadge(userId: number, badgeId: number) {
    return apiRequest<{ removed: boolean }>({
      path: `/api/moderation/users/${userId}/badges/${badgeId}`,
      init: { method: "DELETE" },
    });
  },
  createRestriction(userId: number, payload: CreateAccountRestrictionPayload) {
    return apiRequest<AccountRestrictionDto>({
      path: `/api/moderation/users/${userId}/restrictions`,
      init: {
        method: "POST",
        body: JSON.stringify(payload),
      },
    });
  },
  revokeRestriction(userId: number, restrictionId: number, comment: string) {
    return apiRequest<AccountRestrictionDto>({
      path: `/api/moderation/users/${userId}/restrictions/${restrictionId}/revoke`,
      init: {
        method: "POST",
        body: JSON.stringify({ comment }),
      },
    });
  },
};
