import { apiRequest } from "@/shared/api";

import type { ReferralStoryTarget } from "../model/types";

type ReferralStoryStats = NonNullable<ReferralStoryTarget["stats"]>;

export const referralStoryContextClient = {
  loadStats() {
    return apiRequest<ReferralStoryStats>({
      path: "/api/telegram/referral-story-context",
    });
  },
};
