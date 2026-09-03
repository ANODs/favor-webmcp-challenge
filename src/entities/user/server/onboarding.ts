import { CURRENT_ONBOARDING_VERSION } from "@/shared/lib/onboarding";
import { prisma } from "@/shared/lib/prisma";

export async function completeCurrentUserOnboarding<
  T extends { id: number; onboardingVersion: number },
>(user: T): Promise<T> {
  const onboardingVersion = Math.max(
    user.onboardingVersion,
    CURRENT_ONBOARDING_VERSION,
  );

  if (user.id !== 0 && user.onboardingVersion < CURRENT_ONBOARDING_VERSION) {
    await prisma.user.updateMany({
      where: {
        id: user.id,
        onboardingVersion: { lt: CURRENT_ONBOARDING_VERSION },
      },
      data: { onboardingVersion: CURRENT_ONBOARDING_VERSION },
    });
  }

  return { ...user, onboardingVersion };
}
