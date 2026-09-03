import {
  ContractReferralStatus,
  DealStatus,
  EscrowCurrency,
  Prisma,
} from "@prisma/client";
import { toNano } from "@ton/ton";

import { getEscrowDeadlineDurationSeconds } from "@/entities/deal";
import { buildJettonTransferPayload } from "@/shared/lib/ton/jetton";
import { env } from "@/shared/config/env";
import { getJettonWalletAddress } from "@/shared/lib/ton/server";
import { getTonUsdPrice } from "@/shared/lib/ton/oracle";
import {
  formatStablecoinAmount,
  getStablecoinJettonConfig,
  isStablecoinEscrowCurrency,
  toJettonUnits,
} from "@/shared/lib/ton/stablecoin";
import {
  buildConfigureJettonWalletPayload,
  getDeterministicEscrowAddress,
  getDeterministicScoutEscrowAddress,
  getDeterministicStablecoinJettonEscrowAddress,
} from "@/shared/lib/ton/escrow";
import { getPreparedEscrowContractStatus } from "@/shared/lib/ton/escrow-status.server";
import { handleRouteError, ok } from "@/shared/lib/api";
import { prisma } from "@/shared/lib/prisma";
import { requireUser } from "@/shared/lib/auth";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const { customerWalletAddress } = await request.json() as { customerWalletAddress: string };

    if (!customerWalletAddress) {
      throw new Error("CUSTOMER_WALLET_REQUIRED");
    }

    const deal = await prisma.deal.findUnique({
      where: { id: Number(id) },
      include: {
        freelancer: true,
        contract: {
          select: {
            referral: {
              select: {
                referrerId: true,
                rewardPercent: true,
                status: true,
                referrer: {
                  select: {
                    walletAddress: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!deal) {
      throw new Error("DEAL_NOT_FOUND");
    }

    if (
      !deal.isEscrow ||
      deal.status !== DealStatus.pending_approval ||
      deal.paidByCustomer
    ) {
      throw new Error("ESCROW_PREPARE_INVALID_STATE");
    }

    if (deal.customerId !== user.id && user.role !== "moderator") {
      throw new Error("FORBIDDEN");
    }

    if (deal.escrowAddress) {
      const existingStatus = await getPreparedEscrowContractStatus(
        deal.escrowAddress,
      );
      if (existingStatus !== null && existingStatus > 0n) {
        throw new Error("ESCROW_ALREADY_FUNDED");
      }
    }

    if (
      deal.escrowCurrency !== EscrowCurrency.TON &&
      deal.escrowCurrency !== EscrowCurrency.USDT
    ) {
      throw new Error("ESCROW_CURRENCY_UNSUPPORTED");
    }

    const freelancerWallet = deal.freelancer.walletAddress;
    if (!freelancerWallet) {
      throw new Error("FREELANCER_WALLET_REQUIRED");
    }

    const arbitratorAddress = env.requireTonRecipientWallet();
    const referral = deal.contract?.referral;
    const shouldUseScoutEscrow = Boolean(
      referral &&
        referral.status === ContractReferralStatus.active &&
        referral.referrerId !== deal.customerId &&
        referral.referrerId !== deal.freelancerId,
    );

    if (shouldUseScoutEscrow && !referral?.referrer.walletAddress) {
      throw new Error("REFERRER_WALLET_REQUIRED");
    }

    const serverTime = Math.floor(Date.now() / 1000);
    const deadlineDurationSeconds = getEscrowDeadlineDurationSeconds(
      deal.deadlineDays,
    );
    console.log(`[Escrow Prepare] Deal ID: ${deal.id}, Server Time: ${serverTime}`);

    if (isStablecoinEscrowCurrency(deal.escrowCurrency)) {
      const token = getStablecoinJettonConfig(deal.escrowCurrency);
      const expectedJettonAmount = toJettonUnits(deal.price.toString(), token.decimals);
      const escrowConfig = await getDeterministicStablecoinJettonEscrowAddress({
        platformAddress: arbitratorAddress,
        customerAddress: customerWalletAddress,
        freelancerAddress: freelancerWallet,
        scoutAddress: shouldUseScoutEscrow ? referral?.referrer.walletAddress : null,
        jettonMasterAddress: token.masterAddress,
        dealId: deal.id,
        expectedAmount: expectedJettonAmount,
        scoutCommissionSharePercent: shouldUseScoutEscrow && referral
          ? Math.trunc(Number(referral.rewardPercent))
          : 0,
        deadlineDurationSeconds,
      });
      const customerJettonWalletAddress = await getJettonWalletAddress({
        masterAddress: token.masterAddress,
        ownerAddress: customerWalletAddress,
      });
      const escrowJettonWalletAddress = await getJettonWalletAddress({
        masterAddress: token.masterAddress,
        ownerAddress: escrowConfig.address,
      });
      const customerJettonWallet = customerJettonWalletAddress.toString({
        bounceable: true,
        testOnly: false,
      });
      const escrowJettonWallet = escrowJettonWalletAddress.toString({
        bounceable: true,
        testOnly: false,
      });
      const configureJettonWalletPayload = buildConfigureJettonWalletPayload(
        escrowJettonWallet,
      );
      const jettonTransferPayload = buildJettonTransferPayload({
        amount: expectedJettonAmount,
        recipientAddress: escrowConfig.address,
        responseAddress: customerWalletAddress,
        reference: `favor-stablecoin-escrow:${deal.id}:${token.symbol}`,
        forwardTonAmount: env.stablecoinJettonForwardTon,
      });

      const prepared = await prisma.deal.updateMany({
        where: {
          id: deal.id,
          status: DealStatus.pending_approval,
          paidByCustomer: false,
          escrowAddress: deal.escrowAddress,
          updatedAt: deal.updatedAt,
        },
        data: {
          escrowAddress: escrowConfig.address,
          escrowCustomerWalletAddress: customerWalletAddress,
          escrowState: "awaiting_deposit",
          escrowVersion: 2,
          escrowCurrency: token.symbol,
          escrowLockedAmountTon: null,
          escrowTonUsdtRate: null,
          escrowJettonMasterAddress: token.masterAddress,
          escrowJettonWalletAddress: escrowJettonWallet,
          escrowJettonAmount: new Prisma.Decimal(expectedJettonAmount.toString()),
          escrowFundingCheckedAt: null,
        },
      });
      if (prepared.count !== 1) {
        throw new Error("ESCROW_PREPARE_CONFLICT");
      }

      return ok({
        escrowAddress: escrowConfig.address,
        stateInitBase64: escrowConfig.stateInitBase64,
        paymentAsset: token.symbol,
        tokenSymbol: token.symbol,
        tokenDecimals: token.decimals,
        tokenAmount: expectedJettonAmount.toString(),
        tokenAmountFormatted: formatStablecoinAmount(expectedJettonAmount, token.decimals, token.symbol),
        escrowKind: escrowConfig.kind,
        customerJettonWalletAddress: customerJettonWallet,
        escrowJettonWalletAddress: escrowJettonWallet,
        transactionMessages: [
          {
            address: escrowConfig.address,
            amount: toNano(env.stablecoinEscrowDeployTon).toString(),
            stateInit: escrowConfig.stateInitBase64,
            payload: configureJettonWalletPayload,
          },
          {
            address: customerJettonWallet,
            amount: toNano(env.stablecoinJettonTransferTon).toString(),
            payload: jettonTransferPayload,
          },
        ],
        deal,
        serverTime,
      });
    }

    const tonUsdtPrice = await getTonUsdPrice();
    const dealPriceUsdt = Number(deal.price);
    const amountTon = parseFloat((dealPriceUsdt / tonUsdtPrice).toFixed(6));
    const expectedAmount = toNano(amountTon.toString());

    const escrowConfig = shouldUseScoutEscrow && referral?.referrer.walletAddress
      ? await getDeterministicScoutEscrowAddress({
          platformAddress: arbitratorAddress,
          customerAddress: customerWalletAddress,
          freelancerAddress: freelancerWallet,
          scoutAddress: referral.referrer.walletAddress,
          dealId: deal.id,
          expectedAmount,
          scoutCommissionSharePercent: Math.trunc(Number(referral.rewardPercent)),
          deadlineDurationSeconds,
        })
      : await getDeterministicEscrowAddress({
          arbitratorAddress,
          customerAddress: customerWalletAddress,
          freelancerAddress: freelancerWallet,
          dealId: deal.id,
          expectedAmount,
          deadlineDurationSeconds,
        });

    const prepared = await prisma.deal.updateMany({
      where: {
        id: deal.id,
        status: DealStatus.pending_approval,
        paidByCustomer: false,
        escrowAddress: deal.escrowAddress,
        updatedAt: deal.updatedAt,
      },
      data: {
        escrowAddress: escrowConfig.address,
        escrowCustomerWalletAddress: customerWalletAddress,
        escrowState: "awaiting_deposit",
        escrowVersion: 2,
        escrowCurrency: "TON",
        escrowTonUsdtRate: new Prisma.Decimal(tonUsdtPrice),
        escrowLockedAmountTon: new Prisma.Decimal(amountTon),
        escrowJettonMasterAddress: null,
        escrowJettonWalletAddress: null,
        escrowJettonAmount: null,
        escrowFundingCheckedAt: null,
      },
    });
    if (prepared.count !== 1) {
      throw new Error("ESCROW_PREPARE_CONFLICT");
    }

    return ok({
      escrowAddress: escrowConfig.address,
      stateInitBase64: escrowConfig.stateInitBase64,
      amountTon,
      tonUsdtPrice,
      paymentAsset: "TON",
      escrowKind: escrowConfig.kind,
      deal,
      serverTime,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
