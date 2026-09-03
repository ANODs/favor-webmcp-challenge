import {
  ContractReferralSource,
  ContractReferralRewardStatus,
  ContractReferralStatus,
  Prisma,
} from "@prisma/client";

import {
  CONTRACT_REFERRAL_REWARD_SHARE_PERCENT,
  PLATFORM_COMMISSION_PERCENT,
} from "./model/config";

const platformCommissionPercent = new Prisma.Decimal(PLATFORM_COMMISSION_PERCENT);
const contractReferralRewardSharePercent = new Prisma.Decimal(
  CONTRACT_REFERRAL_REWARD_SHARE_PERCENT,
);

type TransactionClient = Prisma.TransactionClient;

type EnsureContractReferralInput = {
  contractId: number;
  referrerId: number;
  authorId: number;
  source: ContractReferralSource;
};

export async function ensureContractReferralForClaim(
  tx: TransactionClient,
  { contractId, referrerId, authorId, source }: EnsureContractReferralInput,
) {
  if (referrerId === authorId) {
    return null;
  }

  return tx.contractReferral.upsert({
    where: {
      contractId,
    },
    update: {
      referrerId,
      authorId,
      source,
      status: ContractReferralStatus.active,
    },
    create: {
      contractId,
      referrerId,
      authorId,
      source,
      rewardPercent: contractReferralRewardSharePercent,
    },
  });
}

export async function ensureContractReferralForInvitedAuthor(
  tx: TransactionClient,
  { contractId, referrerId, authorId }: Omit<EnsureContractReferralInput, "source">,
) {
  return ensureContractReferralForClaim(tx, {
    contractId,
    referrerId,
    authorId,
    source: ContractReferralSource.user_referral,
  });
}

export async function accrueContractReferralRewardForDeal(
  tx: TransactionClient,
  dealId: number,
) {
  const deal = await tx.deal.findUnique({
    where: {
      id: dealId,
    },
    select: {
      id: true,
      price: true,
      isEscrow: true,
      escrowCurrency: true,
      customerId: true,
      freelancerId: true,
      contract: {
        select: {
          id: true,
          referral: {
            select: {
              id: true,
              referrerId: true,
              rewardPercent: true,
              status: true,
            },
          },
        },
      },
    },
  });

  const contract = deal?.contract;
  const referral = contract?.referral;

  if (!deal || !deal.isEscrow || !contract || !referral || referral.status !== ContractReferralStatus.active) {
    return null;
  }

  if (referral.referrerId === deal.customerId || referral.referrerId === deal.freelancerId) {
    return null;
  }

  const dealAmount = new Prisma.Decimal(deal.price);

  if (dealAmount.lte(0)) {
    return null;
  }

  const platformFeeAmount = dealAmount.mul(platformCommissionPercent).div(100);
  const rewardAmount = platformFeeAmount.mul(referral.rewardPercent).div(100);

  if (rewardAmount.lte(0)) {
    return null;
  }

  return tx.contractReferralReward.upsert({
    where: {
      dealId: deal.id,
    },
    update: {
      dealAmount,
      platformFeePercent: platformCommissionPercent,
      rewardPercent: referral.rewardPercent,
      platformFeeAmount,
      rewardAmount,
      currency: deal.escrowCurrency,
      status: ContractReferralRewardStatus.accrued,
    },
    create: {
      referralId: referral.id,
      contractId: contract.id,
      dealId: deal.id,
      referrerId: referral.referrerId,
      dealAmount,
      platformFeePercent: platformCommissionPercent,
      rewardPercent: referral.rewardPercent,
      platformFeeAmount,
      rewardAmount,
      currency: deal.escrowCurrency,
      status: ContractReferralRewardStatus.accrued,
    },
  });
}

export async function cancelContractReferralRewardForDeal(
  tx: TransactionClient,
  dealId: number,
) {
  return tx.contractReferralReward.updateMany({
    where: {
      dealId,
      status: ContractReferralRewardStatus.accrued,
    },
    data: {
      status: ContractReferralRewardStatus.cancelled,
    },
  });
}
