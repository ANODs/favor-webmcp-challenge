-- Keep existing accounts at version 0 so they receive the first onboarding once.
ALTER TABLE "User"
ADD COLUMN "onboardingVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "User"
ADD CONSTRAINT "User_onboardingVersion_nonnegative_check"
CHECK ("onboardingVersion" >= 0);
