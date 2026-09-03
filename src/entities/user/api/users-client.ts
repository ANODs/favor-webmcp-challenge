import { apiRequest } from "@/shared/api";

import type {
  ProfileSectionItemMap,
  ProfileSectionKey,
  ProfileSectionPageDto,
  UserProfileDto,
} from "./profile-dto";

export const usersClient = {
  getProfile(slug: string) {
    return apiRequest<UserProfileDto>({
      path: `/api/users/${encodeURIComponent(slug)}`,
    });
  },
  getProfileSection<TSection extends ProfileSectionKey>(
    slug: string,
    section: TSection,
    cursor?: string | null,
  ) {
    const searchParams = new URLSearchParams({ section });

    if (cursor) {
      searchParams.set("cursor", cursor);
    }

    return apiRequest<ProfileSectionPageDto<ProfileSectionItemMap[TSection]>>({
      path: `/api/users/${encodeURIComponent(slug)}?${searchParams.toString()}`,
    });
  },
};
