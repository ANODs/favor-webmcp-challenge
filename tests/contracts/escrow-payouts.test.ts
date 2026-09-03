import assert from "node:assert/strict";
import test from "node:test";

import { Blockchain, type Event } from "@ton/sandbox";
import { beginCell, toNano, type Address } from "@ton/core";
import { findTransaction } from "@ton/test-utils";

import { FavorEscrow } from "../../src/shared/lib/ton/contracts/output/FavorEscrow_FavorEscrow";
import { FavorScoutEscrow } from "../../src/shared/lib/ton/contracts/output/FavorScoutEscrow_FavorScoutEscrow";
import { FavorStablecoinJettonEscrow } from "../../src/shared/lib/ton/contracts/output/FavorStablecoinJettonEscrow_FavorStablecoinJettonEscrow";

const DEAL_AMOUNT = toNano("1");
const DEPOSIT_VALUE = toNano("1.08");
const COMPLETION_VALUE = toNano("0.05");
const DEADLINE_DURATION_SECONDS = 3 * 24 * 60 * 60;
const START_TIME = 2_000_000_000;
const FUNDING_DELAY_SECONDS = 3_600;

type SentMessage = Extract<Event, { type: "message_sent" }>;

const collectOutgoingMessages = (events: Event[], sender: Address) => events
  .filter((event): event is SentMessage => event.type === "message_sent")
  .filter((event) => event.from.equals(sender));

const assertPayout = ({
  messages,
  recipient,
  amount,
}: {
  messages: SentMessage[];
  recipient: Address;
  amount: bigint;
}) => {
  assert.ok(
    messages.some((message) => message.to.equals(recipient) && message.value === amount),
    `Expected payout ${amount} nanotons to ${recipient.toString()}`,
  );
};

const assertContractTransaction = ({
  transactions,
  sender,
  recipient,
  success,
}: {
  transactions: Parameters<typeof findTransaction>[0];
  sender: Address;
  recipient: Address;
  success: boolean;
}) => {
  assert.ok(findTransaction(transactions, {
    from: sender,
    to: recipient,
    success,
  }));
};

const assertTonPrincipalRefund = (
  messages: SentMessage[],
  customer: Address,
) => {
  assert.ok(
    messages.some((message) => (
      message.to.equals(customer) && message.value >= DEAL_AMOUNT
    )),
    `Expected refund of at least ${DEAL_AMOUNT} nanotons to ${customer.toString()}`,
  );
};

const collectJettonTransfers = (
  events: Event[],
  escrowAddress: Address,
  jettonWalletAddress: Address,
) => collectOutgoingMessages(events, escrowAddress)
  .filter((message) => message.to.equals(jettonWalletAddress))
  .flatMap((message) => {
    const slice = message.body.beginParse();
    if (slice.remainingBits < 32 || slice.preloadUint(32) !== 0xf8a7ea5) {
      return [];
    }

    slice.loadUint(32);
    slice.loadUintBig(64);
    const amount = slice.loadCoins();
    const recipient = slice.loadAddress();
    return [{ amount, recipient }];
  });

test("standard GRAM escrow pays 95% to freelancer and exactly 5% to platform", async () => {
  const blockchain = await Blockchain.create();
  blockchain.now = START_TIME;
  const platform = await blockchain.treasury("standard-platform");
  const customer = await blockchain.treasury("standard-customer");
  const freelancer = await blockchain.treasury("standard-freelancer");
  const escrow = blockchain.openContract(await FavorEscrow.fromInit(
    platform.address,
    customer.address,
    freelancer.address,
    1n,
    DEAL_AMOUNT,
    BigInt(DEADLINE_DURATION_SECONDS),
  ));

  await escrow.send(customer.getSender(), { value: DEPOSIT_VALUE }, null);
  assert.equal(await escrow.getStatus(), 1n);

  const result = await escrow.send(customer.getSender(), { value: COMPLETION_VALUE }, "complete");
  const messages = collectOutgoingMessages(result.events, escrow.address);
  assertPayout({ messages, recipient: freelancer.address, amount: toNano("0.95") });
  assertPayout({ messages, recipient: platform.address, amount: toNano("0.05") });
});

test("scout GRAM escrow pays 95% to freelancer, 1% to scout, and 4% to platform", async () => {
  const blockchain = await Blockchain.create();
  blockchain.now = START_TIME;
  const platform = await blockchain.treasury("scout-platform");
  const customer = await blockchain.treasury("scout-customer");
  const freelancer = await blockchain.treasury("scout-freelancer");
  const scout = await blockchain.treasury("scout-beneficiary");
  const escrow = blockchain.openContract(await FavorScoutEscrow.fromInit(
    platform.address,
    customer.address,
    freelancer.address,
    scout.address,
    2n,
    DEAL_AMOUNT,
    20n,
    BigInt(DEADLINE_DURATION_SECONDS),
  ));

  await escrow.send(customer.getSender(), { value: DEPOSIT_VALUE }, null);
  assert.equal(await escrow.getStatus(), 1n);

  const result = await escrow.send(customer.getSender(), { value: COMPLETION_VALUE }, "complete");
  const messages = collectOutgoingMessages(result.events, escrow.address);
  assertPayout({ messages, recipient: freelancer.address, amount: toNano("0.95") });
  assertPayout({ messages, recipient: scout.address, amount: toNano("0.01") });
  assertPayout({ messages, recipient: platform.address, amount: toNano("0.04") });
});

test("stablecoin scout escrow emits exact 95/1/4 jetton transfers", async () => {
  const blockchain = await Blockchain.create();
  blockchain.now = START_TIME;
  const platform = await blockchain.treasury("stablecoin-platform");
  const customer = await blockchain.treasury("stablecoin-customer");
  const freelancer = await blockchain.treasury("stablecoin-freelancer");
  const scout = await blockchain.treasury("stablecoin-scout");
  const jettonMaster = await blockchain.treasury("stablecoin-master");
  const configuredJettonWallet = await blockchain.treasury("stablecoin-escrow-wallet");
  const unexpectedJettonWallet = await blockchain.treasury("unexpected-stablecoin-wallet");
  const expectedJettonAmount = 1_000_000n;
  const escrow = blockchain.openContract(await FavorStablecoinJettonEscrow.fromInit(
    platform.address,
    customer.address,
    freelancer.address,
    scout.address,
    jettonMaster.address,
    3n,
    expectedJettonAmount,
    20n,
    BigInt(DEADLINE_DURATION_SECONDS),
  ));

  await escrow.send(customer.getSender(), { value: toNano("0.3") }, {
    $$type: "ConfigureJettonWallet",
    jettonWallet: configuredJettonWallet.address,
  });
  assert.ok((await escrow.getJettonWallet()).equals(configuredJettonWallet.address));

  await escrow.send(customer.getSender(), { value: toNano("0.05") }, {
    $$type: "ConfigureJettonWallet",
    jettonWallet: unexpectedJettonWallet.address,
  });
  assert.ok(
    (await escrow.getJettonWallet()).equals(configuredJettonWallet.address),
    "The configured jetton wallet must be immutable",
  );

  await escrow.send(unexpectedJettonWallet.getSender(), { value: toNano("0.08") }, {
    $$type: "JettonTransferNotification",
    queryId: 0n,
    amount: expectedJettonAmount,
    sender: customer.address,
    forwardPayload: beginCell().endCell().beginParse(),
  });
  assert.equal(await escrow.getStatus(), 0n, "An unexpected jetton wallet must not lock the escrow");

  await escrow.send(configuredJettonWallet.getSender(), { value: toNano("0.08") }, {
    $$type: "JettonTransferNotification",
    queryId: 0n,
    amount: expectedJettonAmount + 1n,
    sender: customer.address,
    forwardPayload: beginCell().endCell().beginParse(),
  });
  assert.equal(await escrow.getStatus(), 0n, "Overpayment must not lock the escrow");

  await escrow.send(configuredJettonWallet.getSender(), { value: toNano("0.08") }, {
    $$type: "JettonTransferNotification",
    queryId: 0n,
    amount: expectedJettonAmount,
    sender: customer.address,
    forwardPayload: beginCell().endCell().beginParse(),
  });
  assert.equal(await escrow.getStatus(), 1n);

  const result = await escrow.send(customer.getSender(), { value: COMPLETION_VALUE }, "complete");
  const transfers = collectJettonTransfers(
    result.events,
    escrow.address,
    configuredJettonWallet.address,
  );

  assert.ok(transfers.some(({ amount, recipient }) => amount === 950_000n && recipient.equals(freelancer.address)));
  assert.ok(transfers.some(({ amount, recipient }) => amount === 10_000n && recipient.equals(scout.address)));
  assert.ok(transfers.some(({ amount, recipient }) => amount === 40_000n && recipient.equals(platform.address)));
});

test("standard GRAM customer refund is rejected before the deadline and returns principal at the boundary", async () => {
  const blockchain = await Blockchain.create();
  blockchain.now = START_TIME;
  const platform = await blockchain.treasury("standard-deadline-platform");
  const customer = await blockchain.treasury("standard-deadline-customer");
  const freelancer = await blockchain.treasury("standard-deadline-freelancer");
  const escrow = blockchain.openContract(await FavorEscrow.fromInit(
    platform.address,
    customer.address,
    freelancer.address,
    4n,
    DEAL_AMOUNT,
    BigInt(DEADLINE_DURATION_SECONDS),
  ));

  const fundedAt = START_TIME + FUNDING_DELAY_SECONDS;
  blockchain.now = fundedAt;
  await escrow.send(customer.getSender(), { value: DEPOSIT_VALUE }, null);
  const deadlineAt = fundedAt + DEADLINE_DURATION_SECONDS;
  assert.equal(await escrow.getDeadlineAt(), BigInt(deadlineAt));

  blockchain.now = deadlineAt - 1;
  const earlyRefund = await escrow.send(
    customer.getSender(),
    { value: COMPLETION_VALUE },
    "refund",
  );
  assertContractTransaction({
    transactions: earlyRefund.transactions,
    sender: customer.address,
    recipient: escrow.address,
    success: false,
  });
  assert.equal(await escrow.getStatus(), 1n);

  blockchain.now = deadlineAt;
  const lateDispute = await escrow.send(
    freelancer.getSender(),
    { value: COMPLETION_VALUE },
    "dispute",
  );
  assertContractTransaction({
    transactions: lateDispute.transactions,
    sender: freelancer.address,
    recipient: escrow.address,
    success: false,
  });
  assert.equal(await escrow.getStatus(), 1n);

  const refund = await escrow.send(
    customer.getSender(),
    { value: COMPLETION_VALUE },
    "refund",
  );
  assertContractTransaction({
    transactions: refund.transactions,
    sender: customer.address,
    recipient: escrow.address,
    success: true,
  });
  assertTonPrincipalRefund(
    collectOutgoingMessages(refund.events, escrow.address),
    customer.address,
  );
});

test("standard customer cannot bypass a dispute, while platform and freelancer refunds remain available", async () => {
  const blockchain = await Blockchain.create();
  blockchain.now = START_TIME;
  const platform = await blockchain.treasury("standard-dispute-platform");
  const customer = await blockchain.treasury("standard-dispute-customer");
  const freelancer = await blockchain.treasury("standard-dispute-freelancer");
  const disputedEscrow = blockchain.openContract(await FavorEscrow.fromInit(
    platform.address,
    customer.address,
    freelancer.address,
    7n,
    DEAL_AMOUNT,
    BigInt(DEADLINE_DURATION_SECONDS),
  ));

  await disputedEscrow.send(customer.getSender(), { value: DEPOSIT_VALUE }, null);
  const deadlineAt = START_TIME + DEADLINE_DURATION_SECONDS;
  await disputedEscrow.send(
    customer.getSender(),
    { value: COMPLETION_VALUE },
    "dispute",
  );
  assert.equal(await disputedEscrow.getStatus(), 3n);

  blockchain.now = deadlineAt;
  const customerRefund = await disputedEscrow.send(
    customer.getSender(),
    { value: COMPLETION_VALUE },
    "refund",
  );
  assertContractTransaction({
    transactions: customerRefund.transactions,
    sender: customer.address,
    recipient: disputedEscrow.address,
    success: false,
  });
  assert.equal(await disputedEscrow.getStatus(), 3n);

  const platformRefund = await disputedEscrow.send(
    platform.getSender(),
    { value: COMPLETION_VALUE },
    "refund",
  );
  assertContractTransaction({
    transactions: platformRefund.transactions,
    sender: platform.address,
    recipient: disputedEscrow.address,
    success: true,
  });
  assertTonPrincipalRefund(
    collectOutgoingMessages(platformRefund.events, disputedEscrow.address),
    customer.address,
  );

  const maxDuration = 0xffff_ffffn;
  const voluntaryEscrow = blockchain.openContract(await FavorEscrow.fromInit(
    platform.address,
    customer.address,
    freelancer.address,
    8n,
    DEAL_AMOUNT,
    maxDuration,
  ));
  const fundedAt = deadlineAt + FUNDING_DELAY_SECONDS;
  blockchain.now = fundedAt;
  await voluntaryEscrow.send(customer.getSender(), { value: DEPOSIT_VALUE }, null);
  assert.equal(await voluntaryEscrow.getDeadlineAt(), BigInt(fundedAt) + maxDuration);

  const freelancerRefund = await voluntaryEscrow.send(
    freelancer.getSender(),
    { value: COMPLETION_VALUE },
    "refund",
  );
  assertContractTransaction({
    transactions: freelancerRefund.transactions,
    sender: freelancer.address,
    recipient: voluntaryEscrow.address,
    success: true,
  });
  assertTonPrincipalRefund(
    collectOutgoingMessages(freelancerRefund.events, voluntaryEscrow.address),
    customer.address,
  );
});

test("scout GRAM customer refund is rejected before the deadline and returns principal after it", async () => {
  const blockchain = await Blockchain.create();
  blockchain.now = START_TIME;
  const platform = await blockchain.treasury("scout-deadline-platform");
  const customer = await blockchain.treasury("scout-deadline-customer");
  const freelancer = await blockchain.treasury("scout-deadline-freelancer");
  const scout = await blockchain.treasury("scout-deadline-beneficiary");
  const escrow = blockchain.openContract(await FavorScoutEscrow.fromInit(
    platform.address,
    customer.address,
    freelancer.address,
    scout.address,
    5n,
    DEAL_AMOUNT,
    20n,
    BigInt(DEADLINE_DURATION_SECONDS),
  ));

  const fundedAt = START_TIME + FUNDING_DELAY_SECONDS;
  blockchain.now = fundedAt;
  await escrow.send(customer.getSender(), { value: DEPOSIT_VALUE }, null);
  const deadlineAt = fundedAt + DEADLINE_DURATION_SECONDS;
  assert.equal(await escrow.getDeadlineAt(), BigInt(deadlineAt));

  blockchain.now = deadlineAt - 1;
  const earlyRefund = await escrow.send(
    customer.getSender(),
    { value: COMPLETION_VALUE },
    "refund",
  );
  assertContractTransaction({
    transactions: earlyRefund.transactions,
    sender: customer.address,
    recipient: escrow.address,
    success: false,
  });
  assert.equal(await escrow.getStatus(), 1n);

  blockchain.now = deadlineAt;
  const lateDispute = await escrow.send(
    freelancer.getSender(),
    { value: COMPLETION_VALUE },
    "dispute",
  );
  assertContractTransaction({
    transactions: lateDispute.transactions,
    sender: freelancer.address,
    recipient: escrow.address,
    success: false,
  });
  assert.equal(await escrow.getStatus(), 1n);

  blockchain.now = deadlineAt + 1;
  const refund = await escrow.send(
    customer.getSender(),
    { value: COMPLETION_VALUE },
    "refund",
  );
  assertContractTransaction({
    transactions: refund.transactions,
    sender: customer.address,
    recipient: escrow.address,
    success: true,
  });
  assertTonPrincipalRefund(
    collectOutgoingMessages(refund.events, escrow.address),
    customer.address,
  );
});

test("stablecoin customer refund is rejected before the deadline and returns the jetton principal at it", async () => {
  const blockchain = await Blockchain.create();
  blockchain.now = START_TIME;
  const platform = await blockchain.treasury("stablecoin-deadline-platform");
  const customer = await blockchain.treasury("stablecoin-deadline-customer");
  const freelancer = await blockchain.treasury("stablecoin-deadline-freelancer");
  const jettonMaster = await blockchain.treasury("stablecoin-deadline-master");
  const configuredJettonWallet = await blockchain.treasury("stablecoin-deadline-wallet");
  const expectedJettonAmount = 1_000_000n;
  const escrow = blockchain.openContract(await FavorStablecoinJettonEscrow.fromInit(
    platform.address,
    customer.address,
    freelancer.address,
    platform.address,
    jettonMaster.address,
    6n,
    expectedJettonAmount,
    0n,
    BigInt(DEADLINE_DURATION_SECONDS),
  ));

  await escrow.send(customer.getSender(), { value: toNano("0.3") }, {
    $$type: "ConfigureJettonWallet",
    jettonWallet: configuredJettonWallet.address,
  });
  assert.equal(await escrow.getDeadlineAt(), 0n);

  const fundedAt = START_TIME + FUNDING_DELAY_SECONDS;
  blockchain.now = fundedAt;
  await escrow.send(configuredJettonWallet.getSender(), { value: toNano("0.08") }, {
    $$type: "JettonTransferNotification",
    queryId: 0n,
    amount: expectedJettonAmount,
    sender: customer.address,
    forwardPayload: beginCell().endCell().beginParse(),
  });
  const deadlineAt = fundedAt + DEADLINE_DURATION_SECONDS;
  assert.equal(await escrow.getDeadlineAt(), BigInt(deadlineAt));

  blockchain.now = deadlineAt - 1;
  const earlyRefund = await escrow.send(
    customer.getSender(),
    { value: toNano("0.15") },
    "refund",
  );
  assertContractTransaction({
    transactions: earlyRefund.transactions,
    sender: customer.address,
    recipient: escrow.address,
    success: false,
  });
  assert.equal(await escrow.getStatus(), 1n);

  blockchain.now = deadlineAt;
  const lateDispute = await escrow.send(
    freelancer.getSender(),
    { value: toNano("0.15") },
    "dispute",
  );
  assertContractTransaction({
    transactions: lateDispute.transactions,
    sender: freelancer.address,
    recipient: escrow.address,
    success: false,
  });
  assert.equal(await escrow.getStatus(), 1n);

  const refund = await escrow.send(
    customer.getSender(),
    { value: toNano("0.15") },
    "refund",
  );
  assertContractTransaction({
    transactions: refund.transactions,
    sender: customer.address,
    recipient: escrow.address,
    success: true,
  });
  const transfers = collectJettonTransfers(
    refund.events,
    escrow.address,
    configuredJettonWallet.address,
  );
  assert.ok(transfers.some(({ amount, recipient }) => (
    amount === expectedJettonAmount && recipient.equals(customer.address)
  )));
});

test("scout and stablecoin voluntary refunds remain available before the deadline", async () => {
  const scoutBlockchain = await Blockchain.create();
  scoutBlockchain.now = START_TIME;
  const scoutPlatform = await scoutBlockchain.treasury("voluntary-scout-platform");
  const scoutCustomer = await scoutBlockchain.treasury("voluntary-scout-customer");
  const scoutFreelancer = await scoutBlockchain.treasury("voluntary-scout-freelancer");
  const scout = await scoutBlockchain.treasury("voluntary-scout-beneficiary");
  const scoutEscrow = scoutBlockchain.openContract(await FavorScoutEscrow.fromInit(
    scoutPlatform.address,
    scoutCustomer.address,
    scoutFreelancer.address,
    scout.address,
    9n,
    DEAL_AMOUNT,
    20n,
    BigInt(DEADLINE_DURATION_SECONDS),
  ));

  await scoutEscrow.send(
    scoutCustomer.getSender(),
    { value: DEPOSIT_VALUE },
    null,
  );
  const scoutRefund = await scoutEscrow.send(
    scoutPlatform.getSender(),
    { value: COMPLETION_VALUE },
    "refund",
  );
  assertContractTransaction({
    transactions: scoutRefund.transactions,
    sender: scoutPlatform.address,
    recipient: scoutEscrow.address,
    success: true,
  });
  assertTonPrincipalRefund(
    collectOutgoingMessages(scoutRefund.events, scoutEscrow.address),
    scoutCustomer.address,
  );

  const stablecoinBlockchain = await Blockchain.create();
  stablecoinBlockchain.now = START_TIME;
  const stablecoinPlatform = await stablecoinBlockchain.treasury("voluntary-stablecoin-platform");
  const stablecoinCustomer = await stablecoinBlockchain.treasury("voluntary-stablecoin-customer");
  const stablecoinFreelancer = await stablecoinBlockchain.treasury("voluntary-stablecoin-freelancer");
  const jettonMaster = await stablecoinBlockchain.treasury("voluntary-stablecoin-master");
  const configuredJettonWallet = await stablecoinBlockchain.treasury("voluntary-stablecoin-wallet");
  const expectedJettonAmount = 1_000_000n;
  const stablecoinEscrow = stablecoinBlockchain.openContract(
    await FavorStablecoinJettonEscrow.fromInit(
      stablecoinPlatform.address,
      stablecoinCustomer.address,
      stablecoinFreelancer.address,
      stablecoinPlatform.address,
      jettonMaster.address,
      10n,
      expectedJettonAmount,
      0n,
      BigInt(DEADLINE_DURATION_SECONDS),
    ),
  );

  await stablecoinEscrow.send(stablecoinCustomer.getSender(), { value: toNano("0.3") }, {
    $$type: "ConfigureJettonWallet",
    jettonWallet: configuredJettonWallet.address,
  });
  await stablecoinEscrow.send(configuredJettonWallet.getSender(), { value: toNano("0.08") }, {
    $$type: "JettonTransferNotification",
    queryId: 0n,
    amount: expectedJettonAmount,
    sender: stablecoinCustomer.address,
    forwardPayload: beginCell().endCell().beginParse(),
  });
  const stablecoinRefund = await stablecoinEscrow.send(
    stablecoinFreelancer.getSender(),
    { value: toNano("0.15") },
    "refund",
  );
  assertContractTransaction({
    transactions: stablecoinRefund.transactions,
    sender: stablecoinFreelancer.address,
    recipient: stablecoinEscrow.address,
    success: true,
  });
  const stablecoinTransfers = collectJettonTransfers(
    stablecoinRefund.events,
    stablecoinEscrow.address,
    configuredJettonWallet.address,
  );
  assert.ok(stablecoinTransfers.some(({ amount, recipient }) => (
    amount === expectedJettonAmount && recipient.equals(stablecoinCustomer.address)
  )));
});
