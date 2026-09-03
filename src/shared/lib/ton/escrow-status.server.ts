import { Address, TonClient } from "@ton/ton";

import { env } from "@/shared/config/env";

import { safeParseAddress } from "./address";

export const ESCROW_STATUS_COMPLETED = 2n;
export const ESCROW_STATUS_ACTIVE = 1n;
export const ESCROW_STATUS_REFUNDED = 4n;

type TonApiAccount = {
  address?: string;
};

type TonApiAction = {
  type?: string;
  status?: string;
  TonTransfer?: {
    sender?: TonApiAccount;
    recipient?: TonApiAccount;
    comment?: string;
  };
  JettonTransfer?: {
    sender?: TonApiAccount;
    recipient?: TonApiAccount;
  };
};

type TonApiEventsResponse = {
  events?: Array<{
    in_progress?: boolean;
    actions?: TonApiAction[];
  }>;
};

const isSameAddress = (candidate: string | undefined, expected: Address) => {
  if (!candidate) {
    return false;
  }

  try {
    return Address.parse(candidate).equals(expected);
  } catch {
    return false;
  }
};

export type EscrowSettlementCommand = "complete" | "refund";

const getSuccessfulSettlementCommands = async (escrowAddress: string) => {
  const expectedAddress = safeParseAddress(escrowAddress);
  const response = await fetch(
    `${env.tonApiBaseUrl}/accounts/${encodeURIComponent(escrowAddress)}/events?limit=10`,
    { headers: { Accept: "application/json" }, cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error(`Unable to fetch escrow events: ${response.status}`);
  }

  const payload = await response.json() as TonApiEventsResponse;

  const commands = new Set<EscrowSettlementCommand>();

  for (const event of payload.events ?? []) {
    if (event.in_progress) {
      continue;
    }

    const actions = event.actions ?? [];
    const hasSuccessfulPayout = actions.some((action) => {
      if (action.status !== "ok") {
        return false;
      }

      if (action.type === "JettonTransfer") {
        return isSameAddress(
          action.JettonTransfer?.sender?.address,
          expectedAddress,
        );
      }

      return action.type === "TonTransfer" &&
        action.TonTransfer?.comment !== "Favor Stablecoin Escrow: Gas refund" &&
        isSameAddress(action.TonTransfer?.sender?.address, expectedAddress);
    });

    if (!hasSuccessfulPayout) {
      continue;
    }

    for (const command of ["complete", "refund"] as const) {
      const hasSettlementCommand = actions.some((action) =>
        action.type === "TonTransfer" &&
        action.status === "ok" &&
        action.TonTransfer?.comment === command &&
        isSameAddress(action.TonTransfer.recipient?.address, expectedAddress));

      if (hasSettlementCommand) {
        commands.add(command);
      }
    }
  }

  return commands;
};

export const getEscrowContractStatus = async (escrowAddress: string) => {
  const tonClient = new TonClient({
    endpoint: env.tonCenterApiBaseUrl,
    apiKey: env.tonCenterApiKey || undefined,
  });
  const result = await tonClient.runMethod(
    safeParseAddress(escrowAddress),
    "status",
  );

  return result.stack.readBigNumber();
};

export const getPreparedEscrowContractStatus = async (
  escrowAddress: string,
) => {
  const tonClient = new TonClient({
    endpoint: env.tonCenterApiBaseUrl,
    apiKey: env.tonCenterApiKey || undefined,
  });
  const address = safeParseAddress(escrowAddress);
  const contractState = await tonClient.getContractState(address);

  if (contractState.state !== "active") {
    return null;
  }

  const result = await tonClient.runMethod(address, "status");
  return result.stack.readBigNumber();
};

export const getEscrowContractDeadlineAt = async (escrowAddress: string) => {
  const tonClient = new TonClient({
    endpoint: env.tonCenterApiBaseUrl,
    apiKey: env.tonCenterApiKey || undefined,
  });
  const result = await tonClient.runMethod(
    safeParseAddress(escrowAddress),
    "deadlineAt",
  );
  const deadlineAtSeconds = result.stack.readBigNumber();

  return deadlineAtSeconds > 0n
    ? new Date(Number(deadlineAtSeconds) * 1000)
    : null;
};

export const getEscrowContractJettonWallet = async (escrowAddress: string) => {
  const tonClient = new TonClient({
    endpoint: env.tonCenterApiBaseUrl,
    apiKey: env.tonCenterApiKey || undefined,
  });
  const result = await tonClient.runMethod(
    safeParseAddress(escrowAddress),
    "jettonWallet",
  );

  return result.stack.readAddress();
};

export const getEscrowReleaseProofWithDependencies = async ({
  getStatus,
  getSettlementCommands,
}: {
  getStatus: () => Promise<bigint>;
  getSettlementCommands: () => Promise<ReadonlySet<EscrowSettlementCommand>>;
}) => {
  try {
    const status = await getStatus();
    return {
      released: status === ESCROW_STATUS_COMPLETED,
      refunded: status === ESCROW_STATUS_REFUNDED,
      status,
    };
  } catch (statusError) {
    const settlementCommands = await getSettlementCommands().catch(() => null);
    const released = settlementCommands?.has("complete") ?? false;
    const refunded = settlementCommands?.has("refund") ?? false;

    if (released || refunded) {
      return {
        released,
        refunded,
        status: null,
      };
    }

    throw statusError;
  }
};

export const getEscrowReleaseProof = async (escrowAddress: string) =>
  getEscrowReleaseProofWithDependencies({
    getStatus: () => getEscrowContractStatus(escrowAddress),
    getSettlementCommands: () =>
      getSuccessfulSettlementCommands(escrowAddress),
  });
