export const ONBOARDING_STEP_IDS = [
  "intro",
  "roles",
  "feed",
  "create",
  "proposal",
  "deal",
  "profile",
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEP_IDS)[number];

export const ONBOARDING_STEP_COUNT = ONBOARDING_STEP_IDS.length;
