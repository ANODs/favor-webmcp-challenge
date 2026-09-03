import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { DealStatus } from "@prisma/client";

import { getDealTimeStatus } from "../../src/entities/deal/model/presentation";
import { getDealTransitionPolicyViolation } from "../../src/entities/deal/model/status";
import { getFundedDealExecutionTiming } from "../../src/features/deal-escrow/server/activate-funded-deal";
import { formatTimeRemaining } from "../../src/shared/lib/format";

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

const createTimedDeal = (plannedDeadlineAt: string) => ({
  status: "in_progress" as const,
  isEscrow: true,
  paidByCustomer: true,
  paymentExpiresAt: null,
  plannedStartedAt: "2026-08-30T09:00:00.000Z",
  plannedDeadlineAt,
});

test("a three-day execution window starts when escrow funding is confirmed", () => {
  const activatedAt = new Date("2026-08-30T09:00:00.000Z");
  const timing = getFundedDealExecutionTiming({
    deal: {
      deadlineDays: 3,
      plannedStartedAt: null,
      plannedDeadlineAt: null,
    },
    activatedAt,
  });

  assert.equal(timing.startedAt?.toISOString(), activatedAt.toISOString());
  assert.equal(
    timing.deadlineAt?.getTime(),
    activatedAt.getTime() + 3 * DAY_IN_MILLISECONDS,
  );
});

test("the database window follows the immutable on-chain funding deadline", () => {
  const onChainDeadlineAt = new Date("2026-09-02T09:00:00.000Z");
  const timing = getFundedDealExecutionTiming({
    deal: {
      deadlineDays: 3,
      plannedStartedAt: null,
      plannedDeadlineAt: null,
    },
    activatedAt: new Date("2026-08-30T09:00:12.000Z"),
    onChainDeadlineAt,
  });

  assert.equal(timing.deadlineAt?.toISOString(), onChainDeadlineAt.toISOString());
  assert.equal(timing.startedAt?.toISOString(), "2026-08-30T09:00:00.000Z");
});

test("repeated funding verification cannot extend an existing deadline", () => {
  const plannedStartedAt = new Date("2026-08-30T09:00:00.000Z");
  const plannedDeadlineAt = new Date("2026-09-02T09:00:00.000Z");
  const timing = getFundedDealExecutionTiming({
    deal: {
      deadlineDays: 3,
      plannedStartedAt,
      plannedDeadlineAt,
    },
    activatedAt: new Date("2026-08-31T12:00:00.000Z"),
    onChainDeadlineAt: new Date("2026-09-03T12:00:00.000Z"),
  });

  assert.equal(timing.startedAt, plannedStartedAt);
  assert.equal(timing.deadlineAt, plannedDeadlineAt);
});

test("the UI expires the timer at the exact deadline boundary", () => {
  const deadline = "2026-09-02T09:00:00.000Z";
  const deal = createTimedDeal(deadline);

  assert.equal(
    getDealTimeStatus(
      deal as Parameters<typeof getDealTimeStatus>[0],
      new Date(deadline).getTime() - 1,
    ).isOverdue,
    false,
  );
  assert.equal(
    getDealTimeStatus(
      deal as Parameters<typeof getDealTimeStatus>[0],
      new Date(deadline).getTime(),
    ).isOverdue,
    true,
  );
  assert.equal(
    formatTimeRemaining(
      deadline,
      "en",
      new Date("2026-08-30T09:00:00.001Z").getTime(),
    ),
    "3d 0h",
  );
  assert.equal(
    formatTimeRemaining(deadline, "en", new Date(deadline).getTime()),
    "Expired / Overdue",
  );
});

test("server transition policy keeps direct and escrow completion workflows separate", () => {
  const common = {
    fromStatus: DealStatus.in_progress,
    isFreelancer: true,
    plannedDeadlineAt: new Date("2026-09-02T09:00:00.000Z"),
    now: new Date("2026-09-01T09:00:00.000Z").getTime(),
  };

  assert.equal(
    getDealTransitionPolicyViolation({
      ...common,
      isEscrow: true,
      toStatus: DealStatus.result_sent_by_freelancer,
    }),
    "payment_flow_mismatch",
  );
  assert.equal(
    getDealTransitionPolicyViolation({
      ...common,
      isEscrow: false,
      toStatus: DealStatus.work_completed_by_freelancer,
    }),
    "payment_flow_mismatch",
  );
  assert.equal(
    getDealTransitionPolicyViolation({
      ...common,
      isEscrow: true,
      toStatus: DealStatus.work_completed_by_freelancer,
    }),
    null,
  );
  assert.equal(
    getDealTransitionPolicyViolation({
      ...common,
      isEscrow: false,
      toStatus: DealStatus.result_sent_by_freelancer,
    }),
    null,
  );
});

test("escrow deadline protects the refund path at the exact boundary", () => {
  const deadline = new Date("2026-09-02T09:00:00.000Z");
  const protectedTransitions = [
    DealStatus.work_completed_by_freelancer,
    DealStatus.in_dispute,
    DealStatus.cancellation_requested,
  ];

  for (const toStatus of protectedTransitions) {
    assert.equal(
      getDealTransitionPolicyViolation({
        fromStatus: DealStatus.in_progress,
        toStatus,
        isEscrow: true,
        isFreelancer: true,
        plannedDeadlineAt: deadline,
        now: deadline.getTime() - 1,
      }),
      null,
    );
    assert.equal(
      getDealTransitionPolicyViolation({
        fromStatus: DealStatus.in_progress,
        toStatus,
        isEscrow: true,
        isFreelancer: true,
        plannedDeadlineAt: deadline,
        now: deadline.getTime(),
      }),
      "escrow_deadline_expired",
    );
  }
});

test("deadline protection does not block the customer or non-execution statuses", () => {
  const deadline = new Date("2026-09-02T09:00:00.000Z");

  assert.equal(
    getDealTransitionPolicyViolation({
      fromStatus: DealStatus.in_progress,
      toStatus: DealStatus.in_dispute,
      isEscrow: true,
      isFreelancer: false,
      plannedDeadlineAt: deadline,
      now: deadline.getTime(),
    }),
    null,
  );
  assert.equal(
    getDealTransitionPolicyViolation({
      fromStatus: DealStatus.work_completed_by_freelancer,
      toStatus: DealStatus.in_dispute,
      isEscrow: true,
      isFreelancer: true,
      plannedDeadlineAt: deadline,
      now: deadline.getTime(),
    }),
    null,
  );
});

test("production runs one shared, idempotent deadline processor every minute", () => {
  const startupSource = readFileSync("scripts/start-production.sh", "utf8");
  const scriptSource = readFileSync(
    "scripts/cron/process-deal-deadlines.ts",
    "utf8",
  );
  const routeSource = readFileSync(
    "src/app/api/cron/process-deal-deadlines/route.ts",
    "utf8",
  );
  const processorSource = readFileSync(
    "src/app/_server/process-deal-deadlines.ts",
    "utf8",
  );

  assert.match(
    startupSource,
    /DEAL_DEADLINE_PROCESS_INTERVAL_SECONDS="\$\{DEAL_DEADLINE_PROCESS_INTERVAL_SECONDS:-60\}"/,
  );
  assert.match(
    startupSource,
    /while true; do[\s\S]*tsx scripts\/cron\/process-deal-deadlines\.ts/,
  );
  assert.match(scriptSource, /processDealDeadlines\(\{ database: prisma \}\)/);
  assert.match(routeSource, /if \(!cronSecret \|\| authHeader !==/);
  assert.match(routeSource, /processDealDeadlines\(\{ database: prisma \}\)/);
  assert.match(processorSource, /pg_try_advisory_xact_lock/);
  assert.match(processorSource, /deadlineCustomerNotifiedAt: null/);
  assert.match(processorSource, /deadlineFreelancerNotifiedAt: null/);
  assert.match(processorSource, /plannedDeadlineAt: \{ lte: now \}/);
});
