import { DealStatus, EscrowCurrency } from "@prisma/client";
import { TonClient, toNano } from "@ton/ton";

import { env } from "@/shared/config/env";
import { formatStablecoinAmount, getStablecoinJettonConfig, isStablecoinEscrowCurrency } from "@/shared/lib/ton/stablecoin";
import { getJettonWalletBalance } from "@/shared/lib/ton/server";
import { handleRouteError, ok } from "@/shared/lib/api";
import { notifyDealStatusChanged } from "@/features/deal-notifications";
import { activateFundedDeal } from "@/features/deal-escrow/server";
import { prisma } from "@/shared/lib/prisma";
import { requireUser } from "@/shared/lib/auth";
import { safeParseAddress } from "@/shared/lib/ton";
import { getEscrowContractDeadlineAt } from "@/shared/lib/ton/escrow-status.server";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

type NotificationDeal = {
  id: number;
  status: DealStatus;
  contract: {
    id: number;
    slug: string;
    titleRu: string | null;
    titleEn: string | null;
  } | null;
  customer: {
    id: number;
    name: string | null;
    telegramId: bigint;
    telegramUsername: string | null;
  };
  freelancer: {
    id: number;
    name: string | null;
    telegramId: bigint;
    telegramUsername: string | null;
  };
};

const notifyLockedDeal = async ({
  dealId,
  actorUserId,
  previousStatus,
}: {
  dealId: number;
  actorUserId: number;
  previousStatus: DealStatus;
}) => {
  const dealForNotifications: NotificationDeal | null = await prisma.deal.findUnique({
    where: { id: dealId },
    select: {
      id: true,
      status: true,
      contract: {
        select: {
          id: true,
          slug: true,
          titleRu: true,
          titleEn: true,
        },
      },
      customer: {
        select: {
          id: true,
          name: true,
          telegramId: true,
          telegramUsername: true,
        },
      },
      freelancer: {
        select: {
          id: true,
          name: true,
          telegramId: true,
          telegramUsername: true,
        },
      },
    },
  });

  if (!dealForNotifications) {
    return;
  }

  await notifyDealStatusChanged({
    deal: dealForNotifications,
    actorUserId,
    previousStatus,
  });
};

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const { txHash } = await request.json() as { txHash?: string };

    const deal = await prisma.deal.findUnique({
      where: { id: Number(id) },
      include: {
        contract: true,
        customer: true,
        freelancer: true,
      },
    });

    if (!deal) {
      throw new Error("DEAL_NOT_FOUND");
    }

    if (deal.customerId !== user.id && user.role !== "moderator") {
      throw new Error("FORBIDDEN");
    }

    if (!deal.escrowAddress) {
      throw new Error("ESCROW_ADDRESS_NOT_PREPARED");
    }
    const escrowAddress = deal.escrowAddress;

    if (
      deal.escrowCurrency !== EscrowCurrency.TON &&
      deal.escrowCurrency !== EscrowCurrency.USDT
    ) {
      throw new Error("ESCROW_CURRENCY_UNSUPPORTED");
    }

    const tonClient = new TonClient({
      endpoint: env.tonCenterApiBaseUrl,
      apiKey: env.tonCenterApiKey || undefined,
    });
    const escrowAddr = safeParseAddress(escrowAddress);
    const finalizeFundedDeal = async () => {
      let onChainDeadlineAt: Date | null = null;

      if (
        !env.enableDevSessionAuth &&
        deal.escrowVersion >= 2 &&
        deal.deadlineDays
      ) {
        onChainDeadlineAt = await getEscrowContractDeadlineAt(
          escrowAddress,
        );
        if (!onChainDeadlineAt) {
          throw new Error("ESCROW_DEADLINE_NOT_STARTED");
        }
      }

      const previousStatus = deal.status;
      const activation = await activateFundedDeal({
        dealId: deal.id,
        txHash,
        activatedAt: new Date(),
        onChainDeadlineAt,
      });

      if (activation.activated) {
        await notifyLockedDeal({
          dealId: deal.id,
          actorUserId: user.id,
          previousStatus,
        });
      }

      return ok(activation.deal);
    };

    if (isStablecoinEscrowCurrency(deal.escrowCurrency)) {
      const token = getStablecoinJettonConfig(deal.escrowCurrency);
      const expectedJettonAmount = deal.escrowJettonAmount
        ? BigInt(deal.escrowJettonAmount.toString())
        : 0n;

      if (!deal.escrowJettonWalletAddress || expectedJettonAmount <= 0n) {
        throw new Error("Stablecoin escrow payment is not prepared");
      }

      let balance = 0n;
      let escrowStatus = 0n;
      let configuredJettonWalletMatches = false;
      let isFunded = false;
      const expectedEscrowJettonWallet = safeParseAddress(
        deal.escrowJettonWalletAddress,
      );

      if (env.enableDevSessionAuth) {
        isFunded = true;
      } else {
        for (let attempt = 1; attempt <= 5; attempt += 1) {
          try {
            const [walletBalance, statusResult, jettonWalletResult] = await Promise.all([
              getJettonWalletBalance(deal.escrowJettonWalletAddress),
              tonClient.runMethod(escrowAddr, "status"),
              tonClient.runMethod(escrowAddr, "jettonWallet"),
            ]);
            balance = walletBalance;
            escrowStatus = statusResult.stack.readBigNumber();
            configuredJettonWalletMatches = jettonWalletResult.stack
              .readAddress()
              .equals(expectedEscrowJettonWallet);
            if (
              escrowStatus === 1n &&
              balance >= expectedJettonAmount &&
              configuredJettonWalletMatches
            ) {
              isFunded = true;
              break;
            }
          } catch (err) {
            console.warn(`[escrow-verify] Error fetching jetton balance, attempt ${attempt}:`, err);
          }

          if (attempt < 5) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
      }

      if (!isFunded) {
        throw new Error(
          `Stablecoin escrow is not locked. Status: ${escrowStatus}. Balance: ${formatStablecoinAmount(balance, token.decimals, token.symbol)}. Expected: ${formatStablecoinAmount(expectedJettonAmount, token.decimals, token.symbol)}. Jetton wallet matches: ${configuredJettonWalletMatches}`,
        );
      }

      return finalizeFundedDeal();
    }

    const expectedTonDecimal = deal.escrowLockedAmountTon ? Number(deal.escrowLockedAmountTon) : 0;
    const expectedNano = toNano(expectedTonDecimal.toString());

    let balance = BigInt(0);
    let escrowStatus = 0n;
    let isFunded = false;

    if (env.enableDevSessionAuth) {
      isFunded = true;
    } else {
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        try {
          const [contractBalance, statusResult] = await Promise.all([
            tonClient.getBalance(escrowAddr),
            tonClient.runMethod(escrowAddr, "status"),
          ]);
          balance = contractBalance;
          escrowStatus = statusResult.stack.readBigNumber();
          if (escrowStatus === 1n && balance >= expectedNano) {
            isFunded = true;
            break;
          }
        } catch (err) {
          console.warn(`[escrow-verify] Error fetching balance, attempt ${attempt}:`, err);
        }

        if (attempt < 5) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }

    if (!isFunded) {
      console.warn("[escrow-verify] contract is not funded", {
        escrowStatus,
        balance: (Number(balance) / 1e9).toFixed(4),
        expected: expectedTonDecimal,
      });
      throw new Error("ESCROW_NOT_FUNDED");
    }

    return finalizeFundedDeal();
  } catch (error) {
    return handleRouteError(error);
  }
}
