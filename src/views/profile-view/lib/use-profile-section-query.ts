"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

import {
  userQueryKeys,
  usersClient,
  type ProfileSectionKey,
} from "@/entities/user";

export function useProfileSectionQuery<TSection extends ProfileSectionKey>(
  profileSlug: string | null,
  section: TSection,
  enabled: boolean,
) {
  return useInfiniteQuery({
    queryKey: userQueryKeys.profileSection(profileSlug, section),
    queryFn: ({ pageParam }) =>
      usersClient.getProfileSection(profileSlug!, section, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(profileSlug && enabled),
  });
}
