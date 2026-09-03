import {
  Address,
  beginCell,
  Cell,
  JettonMaster,
  JettonWallet,
  loadMessage,
  storeMessage,
  TonClient,
  type Message,
  type Transaction,
} from "@ton/ton";

import { env } from "@/shared/config/env";
import { isTonSubscriptionReferenceForUser } from "@/shared/lib/ton/common";
import { safeParseAddress } from "./address";

const TON_TRANSACTION_LOOKUP_ATTEMPTS = 12;
const TON_TRANSACTION_LOOKUP_DELAY_MS = 2000;

const tonClient = new TonClient({
  endpoint: env.tonCenterApiBaseUrl,
  apiKey: env.tonCenterApiKey || undefined,
});

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const getJettonWalletAddress = async ({
  masterAddress,
  ownerAddress,
}: {
  masterAddress: string;
  ownerAddress: string;
}) => {
  const master = tonClient.open(JettonMaster.create(Address.parse(masterAddress)));
  return master.getWalletAddress(Address.parse(ownerAddress));
};

export const getJettonWalletBalance = async (walletAddress: string) => {
  const wallet = tonClient.open(JettonWallet.create(Address.parse(walletAddress)));
  return wallet.getBalance();
};

const getNormalizedExtMessageHash = (message: Message) => {
  if (message.info.type !== "external-in") {
    throw new Error(`Message must be "external-in", got ${message.info.type}`);
  }

  return beginCell()
    .store(
      storeMessage(
        {
          ...message,
          init: null,
          info: {
            ...message.info,
            src: undefined,
            importFee: BigInt(0),
          },
        },
        { forceRef: true },
      ),
    )
    .endCell()
    .hash();
};

const readTextComment = (body: Cell) => {
  const slice = body.beginParse();

  if (slice.remainingBits < 32) {
    return null;
  }

  const opcode = slice.loadUint(32);

  if (opcode !== 0) {
    return null;
  }

  return slice.loadStringTail();
};

const TRANSACTION_PAGE_SIZE = 50;
const DEFAULT_TRANSACTION_SEARCH_PAGES = 40;

type AccountTransactionSearchResult =
  | { status: "found"; transaction: Transaction }
  | { status: "not_found" }
  | { status: "budget_exhausted" };

const isTransactionAborted = (transaction: Transaction) =>
  transaction.description.type === "generic" &&
  transaction.description.aborted;

const findAccountTransaction = async ({
  address,
  matches,
  earliestTimestamp,
  maxPages = DEFAULT_TRANSACTION_SEARCH_PAGES,
}: {
  address: Address;
  matches: (transaction: Transaction) => boolean;
  earliestTimestamp?: number;
  maxPages?: number;
}): Promise<AccountTransactionSearchResult> => {
  let cursor: { lt: string; hash: string } | undefined;

  for (let page = 0; page < maxPages; page += 1) {
    const transactions = await tonClient.getTransactions(address, {
      limit: TRANSACTION_PAGE_SIZE,
      archival: true,
      ...(cursor ? { ...cursor, inclusive: false } : {}),
    });

    for (const transaction of transactions) {
      if (matches(transaction)) {
        return { status: "found", transaction };
      }
    }

    const oldestTransaction = transactions.at(-1);
    if (
      !oldestTransaction ||
      transactions.length < TRANSACTION_PAGE_SIZE ||
      (earliestTimestamp !== undefined &&
        oldestTransaction.now < earliestTimestamp)
    ) {
      return { status: "not_found" };
    }

    cursor = {
      lt: oldestTransaction.lt.toString(),
      hash: oldestTransaction.hash().toString("base64"),
    };
  }

  return { status: "budget_exhausted" };
};

const FAVOR_INTERNAL_TRANSFER_OPCODE = 0x178d4519;
const FAVOR_TRANSFER_OPCODE = 0x0f8a7ea5;

const parseFavorJettonTransfer = (body: Cell) => {
  const slice = body.beginParse();
  if (slice.remainingBits < 32 || slice.loadUint(32) !== FAVOR_TRANSFER_OPCODE) {
    return null;
  }

  slice.loadUint(64);
  const amount = slice.loadCoins();
  const destination = slice.loadAddress();
  const responseDestination = slice.loadAddress();
  if (slice.loadBit()) slice.loadRef();
  slice.loadCoins();

  let payload = slice;
  if (slice.remainingBits > 0 && slice.loadBit()) {
    payload = slice.loadRef().beginParse();
  }
  const comment = payload.remainingBits >= 32 && payload.loadUint(32) === 0
    ? payload.loadStringTail()
    : null;

  return { amount, destination, responseDestination, comment };
};

const parseFavorJettonInternalTransfer = (body: Cell) => {
  const slice = body.beginParse();

  if (slice.remainingBits < 32) {
    return null;
  }

  const opcode = slice.loadUint(32);

  if (opcode !== FAVOR_INTERNAL_TRANSFER_OPCODE) {
    return null;
  }

  slice.loadUint(64);
  const amount = slice.loadCoins();
  const from = slice.loadAddress();
  slice.loadAddress();
  slice.loadCoins();

  let payloadSlice = slice;

  if (slice.remainingBits > 0 && slice.loadBit()) {
    payloadSlice = slice.loadRef().beginParse();
  }

  let comment: string | null = null;

  if (payloadSlice.remainingBits >= 32) {
    const commentOp = payloadSlice.loadUint(32);

    if (commentOp === 0) {
      comment = payloadSlice.loadStringTail();
    }
  }

  return {
    amount,
    sender: from.toString(),
    comment,
  };
};

const extractFavorBurnEvent = (transaction: Transaction) => {
  if (!transaction.inMessage || transaction.inMessage.info.type !== "internal") {
    return null;
  }

  try {
    const transfer = parseFavorJettonInternalTransfer(transaction.inMessage.body);

    if (!transfer || transfer.amount <= 0n) {
      return null;
    }

    return {
      amount: transfer.amount.toString(),
      sender: transfer.sender,
      comment: transfer.comment,
      timestamp: transaction.now,
      transactionHash: transaction.hash().toString("base64"),
    };
  } catch (e) {
    console.warn("[extractFavorBurnEvent] Parse warning for tx message:", e);
    return null;
  }
};

type FavorBurnEvent = NonNullable<ReturnType<typeof extractFavorBurnEvent>>;

const findTransactionByBoc = async (boc: string) => {
  const inMessage = loadMessage(Cell.fromBase64(boc).beginParse());

  if (inMessage.info.type !== "external-in") {
    throw new Error("TON_PAYMENT_INVALID_BOC");
  }

  const account = inMessage.info.dest;
  const targetHash = getNormalizedExtMessageHash(inMessage);

  const matchesBoc = (transaction: Transaction) =>
    transaction.inMessage?.info.type === "external-in" &&
    getNormalizedExtMessageHash(transaction.inMessage).equals(targetHash);

  for (let attempt = 0; attempt < TON_TRANSACTION_LOOKUP_ATTEMPTS; attempt += 1) {
    const result = await findAccountTransaction({
      address: account,
      matches: matchesBoc,
      maxPages:
        attempt === TON_TRANSACTION_LOOKUP_ATTEMPTS - 1
          ? DEFAULT_TRANSACTION_SEARCH_PAGES
          : 1,
    });

    if (result.status === "found") return result;

    if (attempt === TON_TRANSACTION_LOOKUP_ATTEMPTS - 1) {
      return result;
    }

    if (attempt < TON_TRANSACTION_LOOKUP_ATTEMPTS - 1) {
      await sleep(TON_TRANSACTION_LOOKUP_DELAY_MS);
    }
  }

  return { status: "not_found" } as const;
};

export const verifyTonSubscriptionTransaction = async ({
  boc,
  reference,
  userId,
  expectedAmountNano,
  senderAddress,
  recipientAddress,
}: {
  boc: string;
  reference: string;
  userId: number;
  expectedAmountNano: bigint;
  senderAddress: string;
  recipientAddress: string;
}) => {
  if (!isTonSubscriptionReferenceForUser(reference, userId)) {
    throw new Error("TON_PAYMENT_INVALID_REFERENCE");
  }

  const transactionLookup = await findTransactionByBoc(boc);

  if (transactionLookup.status === "budget_exhausted") {
    throw new Error("TON_PAYMENT_SEARCH_BUDGET_EXHAUSTED");
  }
  if (transactionLookup.status === "not_found") {
    throw new Error("TON_PAYMENT_NOT_FOUND");
  }
  const transaction = transactionLookup.transaction;

  if (
    transaction.inMessage?.info.type !== "external-in" ||
    !transaction.inMessage.info.dest.equals(safeParseAddress(senderAddress))
  ) {
    throw new Error("TON_PAYMENT_INVALID_SENDER");
  }

  const recipient = safeParseAddress(recipientAddress);
  const matchedMessage = transaction.outMessages.values().find((message) => {
    if (message.info.type !== "internal") {
      return false;
    }

    if (!message.info.dest.equals(recipient)) {
      return false;
    }

    if (message.info.value.coins !== expectedAmountNano) {
      return false;
    }

    return readTextComment(message.body) === reference;
  });

  if (!matchedMessage) {
    throw new Error("TON_PAYMENT_MISMATCH");
  }

  return {
    transactionHash: transaction.hash().toString("base64"),
    timestamp: transaction.now,
  };
};

export const findTonSubscriptionTransactionByReference = async ({
  reference,
  userId,
  expectedAmountNano,
  senderAddress,
  recipientAddress,
  earliestTimestamp,
}: {
  reference: string;
  userId: number;
  expectedAmountNano: bigint;
  senderAddress: string;
  recipientAddress: string;
  earliestTimestamp: number;
}) => {
  if (!isTonSubscriptionReferenceForUser(reference, userId)) {
    throw new Error("TON_PAYMENT_INVALID_REFERENCE");
  }

  const sender = safeParseAddress(senderAddress);
  const recipient = safeParseAddress(recipientAddress);
  const result = await findAccountTransaction({
    address: recipient,
    earliestTimestamp,
    matches: (candidate) => {
      const message = candidate.inMessage;

      return Boolean(
        !isTransactionAborted(candidate) &&
          message?.info.type === "internal" &&
          message.info.src?.equals(sender) &&
          message.info.dest.equals(recipient) &&
          message.info.value.coins === expectedAmountNano &&
          readTextComment(message.body) === reference,
      );
    },
  });

  return result.status === "found"
    ? {
        status: "found" as const,
        transactionHash: result.transaction.hash().toString("base64"),
        timestamp: result.transaction.now,
      }
    : result;
};

export const findFavorSubscriptionTransactionByReference = async ({
  reference,
  expectedFavorAmountNano,
  senderAddress,
  senderJettonWalletAddress,
  recipientJettonWalletAddress,
  earliestTimestamp,
}: {
  reference: string;
  expectedFavorAmountNano: bigint;
  senderAddress: string;
  senderJettonWalletAddress: string;
  recipientJettonWalletAddress: string;
  earliestTimestamp: number;
}) => {
  if (!reference.startsWith("favor-payment:")) {
    throw new Error("FAVOR_PAYMENT_INVALID_REFERENCE");
  }

  const sender = safeParseAddress(senderAddress);
  const senderJettonWallet = safeParseAddress(senderJettonWalletAddress);
  const recipientJettonWallet = safeParseAddress(recipientJettonWalletAddress);
  const result = await findAccountTransaction({
    address: recipientJettonWallet,
    earliestTimestamp,
    matches: (candidate) => {
      if (
        !candidate.inMessage ||
        candidate.inMessage.info.type !== "internal" ||
        !candidate.inMessage.info.src?.equals(senderJettonWallet) ||
        !candidate.inMessage.info.dest.equals(recipientJettonWallet) ||
        isTransactionAborted(candidate)
      ) {
        return false;
      }

      try {
        const transfer = parseFavorJettonInternalTransfer(
          candidate.inMessage.body,
        );

        return Boolean(
          transfer?.comment === reference &&
            transfer.amount === expectedFavorAmountNano &&
            Address.parse(transfer.sender).equals(sender),
        );
      } catch (error) {
        console.warn(
          "[findFavorSubscriptionTransactionByReference] Parse warning:",
          error,
        );
        return false;
      }
    },
  });

  if (result.status !== "found") return result;
  const transaction = result.transaction;
  if (!transaction.inMessage) {
    throw new Error("FAVOR_PAYMENT_INVALID_TRANSFER");
  }
  const transfer = parseFavorJettonInternalTransfer(
    transaction.inMessage.body,
  );
  if (!transfer) throw new Error("FAVOR_PAYMENT_INVALID_TRANSFER");

  return {
    status: "found" as const,
    transactionHash: transaction.hash().toString("base64"),
    amount: transfer.amount.toString(),
    sender: transfer.sender,
    timestamp: transaction.now,
  };
};

/**
 * Verifies a FAVOR Jetton payment sent to the official TON Null/Burn Address.
 * Scans the frozen recipient Jetton Wallet and decodes the standard
 * op::internal_transfer (0x178d4519) cell body.
 */
export const verifyFavorJettonSubscriptionTransaction = async ({
  reference,
  expectedFavorAmountNano,
  senderAddress,
  senderJettonWalletAddress,
  recipientJettonWalletAddress,
  boc,
}: {
  reference: string;
  expectedFavorAmountNano: bigint;
  senderAddress: string;
  senderJettonWalletAddress: string;
  recipientJettonWalletAddress: string;
  boc: string;
}) => {
  if (!reference.startsWith("favor-payment:")) {
    throw new Error("FAVOR_PAYMENT_INVALID_REFERENCE");
  }

  const burnAddress = Address.parse("EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c");
  const sender = safeParseAddress(senderAddress);
  const senderJettonWallet = safeParseAddress(senderJettonWalletAddress);
  const walletTransactionLookup = await findTransactionByBoc(boc);

  if (walletTransactionLookup.status === "budget_exhausted") {
    throw new Error("FAVOR_PAYMENT_SEARCH_BUDGET_EXHAUSTED");
  }
  if (walletTransactionLookup.status === "not_found") {
    throw new Error("FAVOR_PAYMENT_NOT_FOUND");
  }
  const walletTransaction = walletTransactionLookup.transaction;

  if (
    walletTransaction.inMessage?.info.type !== "external-in" ||
    !walletTransaction.inMessage.info.dest.equals(sender)
  ) {
    throw new Error("FAVOR_PAYMENT_INVALID_SENDER");
  }

  const requestedTransfer = walletTransaction.outMessages.values().find((message) => {
    if (message.info.type !== "internal" || !message.info.dest.equals(senderJettonWallet)) {
      return false;
    }
    const transfer = parseFavorJettonTransfer(message.body);
    return Boolean(
      transfer &&
        transfer.amount === expectedFavorAmountNano &&
        transfer.destination.equals(burnAddress) &&
        transfer.responseDestination.equals(sender) &&
        transfer.comment === reference,
    );
  });
  if (!requestedTransfer) {
    throw new Error("FAVOR_PAYMENT_MISMATCH");
  }

  const FAVOR_TRANSACTION_LOOKUP_ATTEMPTS = 15;
  const FAVOR_TRANSACTION_LOOKUP_DELAY_MS = 2500;

  for (let attempt = 0; attempt < FAVOR_TRANSACTION_LOOKUP_ATTEMPTS; attempt += 1) {
    const verification = await findFavorSubscriptionTransactionByReference({
      reference,
      expectedFavorAmountNano,
      senderAddress,
      senderJettonWalletAddress,
      recipientJettonWalletAddress,
      earliestTimestamp: walletTransaction.now - 60,
    });

    if (verification.status === "found") return verification;
    if (verification.status === "budget_exhausted") {
      throw new Error("FAVOR_PAYMENT_SEARCH_BUDGET_EXHAUSTED");
    }

    if (attempt < FAVOR_TRANSACTION_LOOKUP_ATTEMPTS - 1) {
      await sleep(FAVOR_TRANSACTION_LOOKUP_DELAY_MS);
    }
  }

  throw new Error("FAVOR_PAYMENT_NOT_FOUND");
};

/**
 * Resolves the FAVOR Jetton Wallet address for the official TON Null/Burn Address
 * and retrieves its actual balance (total burned FAVOR tokens) via get_wallet_data.
 */
export const getFavorBurnStats = async () => {
  try {
    const jettonMasterAddress = Address.parse(env.requireFavorJettonMasterAddress());
    const burnAddress = Address.parse("EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c");

    // Resolve Burn Jetton Wallet Address
    const runResult = await tonClient.runMethod(jettonMasterAddress, "get_wallet_address", [
      {
        type: "slice",
        cell: beginCell().storeAddress(burnAddress).endCell(),
      },
    ]);
    const burnJettonWalletAddress = runResult.stack.readAddress();

    // Call get_wallet_data on that burn Jetton Wallet
    let burnedAmountNano = BigInt(0);
    let isInitialized = false;
    let burnEvents: FavorBurnEvent[] = [];

    try {
      const walletData = await tonClient.runMethod(burnJettonWalletAddress, "get_wallet_data");
      burnedAmountNano = walletData.stack.readBigNumber(); // First item is balance
      isInitialized = true;
    } catch (e) {
      console.warn("[getFavorBurnStats] Burn wallet might not be active/initialized yet:", e);
    }

    try {
      const transactions = await tonClient.getTransactions(burnJettonWalletAddress, {
        limit: 50,
        archival: true,
      });

      burnEvents = transactions
        .map(extractFavorBurnEvent)
        .filter((event): event is FavorBurnEvent => event !== null)
        .sort((a, b) => a.timestamp - b.timestamp);
    } catch (e) {
      console.warn("[getFavorBurnStats] Failed to fetch burn transaction history:", e);
    }

    return {
      burnedAmount: burnedAmountNano.toString(),
      burnWalletAddress: burnAddress.toString(),
      burnJettonWalletAddress: burnJettonWalletAddress.toString(),
      isInitialized,
      burnEvents,
    };
  } catch (e) {
    console.error("[getFavorBurnStats] Failed to fetch burn stats:", e);
    return {
      burnedAmount: "0",
      burnWalletAddress: "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c",
      burnJettonWalletAddress: "",
      isInitialized: false,
      burnEvents: [],
    };
  }
};


