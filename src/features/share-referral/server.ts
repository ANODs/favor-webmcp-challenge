import { ContractStatus, DealStatus } from "@prisma/client";

import { prisma } from "@/shared/lib/prisma";

import type { ReferralPlatformStats } from "./lib/share-message";

const REFERRAL_STATS_CACHE_TTL_MS = 60_000;

let cachedStats:
  | {
      expiresAt: number;
      value: ReferralPlatformStats;
    }
  | undefined;
let pendingStats: Promise<ReferralPlatformStats> | undefined;

const loadReferralPlatformStats = async (): Promise<ReferralPlatformStats> => {
  const [usersCount, activeContractsCount, completedDealsCount] =
    await prisma.$transaction([
      prisma.user.count(),
      prisma.contract.count({ where: { status: ContractStatus.active } }),
      prisma.deal.count({ where: { status: DealStatus.completed } }),
    ]);

  return { usersCount, activeContractsCount, completedDealsCount };
};

export async function getReferralPlatformStats(): Promise<ReferralPlatformStats> {
  const now = Date.now();
  if (cachedStats && cachedStats.expiresAt > now) {
    return cachedStats.value;
  }

  if (!pendingStats) {
    pendingStats = loadReferralPlatformStats()
      .then((value) => {
        cachedStats = {
          expiresAt: Date.now() + REFERRAL_STATS_CACHE_TTL_MS,
          value,
        };
        return value;
      })
      .finally(() => {
        pendingStats = undefined;
      });
  }

  return pendingStats;
}
