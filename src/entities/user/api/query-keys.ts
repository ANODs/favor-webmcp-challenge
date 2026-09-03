import type { ProfileSectionKey } from "./profile-dto";

export const userQueryKeys = {
  profiles: ["profile"] as const,
  profile: (profileSlug: string | null) =>
    ["profile", profileSlug] as const,
  profileSections: ["profile-section"] as const,
  profileSection: (
    profileSlug: string | null,
    section: ProfileSectionKey,
  ) => ["profile-section", profileSlug, section] as const,
};
