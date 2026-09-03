import assert from "node:assert/strict";
import test from "node:test";
import { DealStatus } from "@prisma/client";

import { canTransitionDeal } from "../../src/entities/deal/model/status";
import { getAvailableDealTransitions } from "../../src/entities/deal/model/presentation";

const makeDeal = (isEscrow: boolean) =>
  ({
    status: DealStatus.in_progress,
    isEscrow,
    customerId: 1,
    freelancerId: 2,
  }) as Parameters<typeof getAvailableDealTransitions>[0];

test("an escrow freelancer can mark in-progress work as completed", () => {
  assert.equal(
    canTransitionDeal(
      DealStatus.in_progress,
      DealStatus.work_completed_by_freelancer,
    ),
    true,
  );

  assert.deepEqual(getAvailableDealTransitions(makeDeal(true), 2), [
    DealStatus.work_completed_by_freelancer,
    DealStatus.cancellation_requested,
    DealStatus.in_dispute,
  ]);
});

test("a direct-deal freelancer keeps the legacy result-sent transition", () => {
  assert.deepEqual(getAvailableDealTransitions(makeDeal(false), 2), [
    DealStatus.result_sent_by_freelancer,
    DealStatus.cancellation_requested,
    DealStatus.in_dispute,
  ]);
});

test("an escrow customer can move completed work to review after payout", () => {
  assert.equal(
    canTransitionDeal(
      DealStatus.work_completed_by_freelancer,
      DealStatus.awaiting_review,
    ),
    true,
  );
});
