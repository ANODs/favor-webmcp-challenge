import { beginCell, contractAddress, type StateInit } from "@ton/ton";
import { safeParseAddress } from "./address";
import { FavorEscrow } from "./contracts/output/FavorEscrow_FavorEscrow";
import { FavorScoutEscrow } from "./contracts/output/FavorScoutEscrow_FavorScoutEscrow";
import {
  FavorStablecoinJettonEscrow,
  storeConfigureJettonWallet,
} from "./contracts/output/FavorStablecoinJettonEscrow_FavorStablecoinJettonEscrow";

const SCOUT_COMMISSION_SHARE_PERCENT = 20;
const MAX_UINT32 = 0xffff_ffff;

const toDeadlineDuration = (deadlineDurationSeconds: number) => {
  if (
    !Number.isSafeInteger(deadlineDurationSeconds)
    || deadlineDurationSeconds <= 0
    || deadlineDurationSeconds > MAX_UINT32
  ) {
    throw new Error("TON_ESCROW_DEADLINE_DURATION_INVALID");
  }

  return BigInt(deadlineDurationSeconds);
};

const toStateInitBase64 = (stateInit: StateInit) => {
  const code = stateInit.code;
  const data = stateInit.data;

  if (!code || !data) {
    throw new Error("TON_ESCROW_STATE_INIT_INCOMPLETE");
  }

  return beginCell()
    .storeWritable((builder) => {
      builder.storeBit(false);
      builder.storeBit(false);
      builder.storeBit(true);
      builder.storeRef(code);
      builder.storeBit(true);
      builder.storeRef(data);
      builder.storeBit(false);
    })
    .endCell()
    .toBoc()
    .toString("base64");
};

/**
 * Pre-computes the deterministic contract address and returns the StateInit cell
 */
export async function getDeterministicEscrowAddress({
  arbitratorAddress,
  customerAddress,
  freelancerAddress,
  dealId,
  expectedAmount,
  deadlineDurationSeconds,
}: {
  arbitratorAddress: string;
  customerAddress: string;
  freelancerAddress: string;
  dealId: number;
  expectedAmount: bigint;
  deadlineDurationSeconds: number;
}) {
  const arbitrator = safeParseAddress(arbitratorAddress);
  const customer = safeParseAddress(customerAddress);
  const freelancer = safeParseAddress(freelancerAddress);

  const stateInit = await FavorEscrow.init(
    arbitrator,
    customer,
    freelancer,
    BigInt(dealId),
    expectedAmount,
    toDeadlineDuration(deadlineDurationSeconds),
  );

  // Derive address on workchain 0 (basechain)
  const addr = contractAddress(0, stateInit);

  return {
    address: addr.toString({ bounceable: true, testOnly: false }),
    stateInitBase64: toStateInitBase64(stateInit),
    kind: "standard" as const,
  };
}

export async function getDeterministicScoutEscrowAddress({
  platformAddress,
  customerAddress,
  freelancerAddress,
  scoutAddress,
  dealId,
  expectedAmount,
  scoutCommissionSharePercent = SCOUT_COMMISSION_SHARE_PERCENT,
  deadlineDurationSeconds,
}: {
  platformAddress: string;
  customerAddress: string;
  freelancerAddress: string;
  scoutAddress: string;
  dealId: number;
  expectedAmount: bigint;
  scoutCommissionSharePercent?: number;
  deadlineDurationSeconds: number;
}) {
  const platform = safeParseAddress(platformAddress);
  const customer = safeParseAddress(customerAddress);
  const freelancer = safeParseAddress(freelancerAddress);
  const scout = safeParseAddress(scoutAddress);

  const stateInit = await FavorScoutEscrow.init(
    platform,
    customer,
    freelancer,
    scout,
    BigInt(dealId),
    expectedAmount,
    BigInt(scoutCommissionSharePercent),
    toDeadlineDuration(deadlineDurationSeconds),
  );

  const addr = contractAddress(0, stateInit);

  return {
    address: addr.toString({ bounceable: true, testOnly: false }),
    stateInitBase64: toStateInitBase64(stateInit),
    kind: "scout" as const,
  };
}

export async function getDeterministicStablecoinJettonEscrowAddress({
  platformAddress,
  customerAddress,
  freelancerAddress,
  scoutAddress,
  jettonMasterAddress,
  dealId,
  expectedAmount,
  scoutCommissionSharePercent = 0,
  deadlineDurationSeconds,
}: {
  platformAddress: string;
  customerAddress: string;
  freelancerAddress: string;
  scoutAddress?: string | null;
  jettonMasterAddress: string;
  dealId: number;
  expectedAmount: bigint;
  scoutCommissionSharePercent?: number;
  deadlineDurationSeconds: number;
}) {
  const platform = safeParseAddress(platformAddress);
  const customer = safeParseAddress(customerAddress);
  const freelancer = safeParseAddress(freelancerAddress);
  const scout = safeParseAddress(scoutAddress || platformAddress);
  const jettonMaster = safeParseAddress(jettonMasterAddress);

  const stateInit = await FavorStablecoinJettonEscrow.init(
    platform,
    customer,
    freelancer,
    scout,
    jettonMaster,
    BigInt(dealId),
    expectedAmount,
    BigInt(scoutCommissionSharePercent),
    toDeadlineDuration(deadlineDurationSeconds),
  );

  const addr = contractAddress(0, stateInit);

  return {
    address: addr.toString({ bounceable: true, testOnly: false }),
    stateInitBase64: toStateInitBase64(stateInit),
    kind: scoutCommissionSharePercent > 0 ? "stablecoin_scout" as const : "stablecoin" as const,
  };
}

export const buildConfigureJettonWalletPayload = (jettonWalletAddress: string) =>
  beginCell()
    .store(storeConfigureJettonWallet({
      $$type: "ConfigureJettonWallet",
      jettonWallet: safeParseAddress(jettonWalletAddress),
    }))
    .endCell()
    .toBoc()
    .toString("base64");
