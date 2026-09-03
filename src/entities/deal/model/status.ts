import { DealStatus } from "@prisma/client";

import { isDealDeadlineExpired } from "./timing";

export const OPEN_DEAL_STATUSES: DealStatus[] = [
  DealStatus.pending_approval,
  DealStatus.in_progress,
  DealStatus.work_completed_by_freelancer,
  DealStatus.paid_by_customer,
  DealStatus.payment_received_by_freelancer,
  DealStatus.result_sent_by_freelancer,
  DealStatus.result_received_by_customer,
  DealStatus.revision_requested,
  DealStatus.awaiting_review,
  DealStatus.in_dispute,
  DealStatus.cancellation_requested,
];

export const DEAL_TRANSITIONS: Record<DealStatus, DealStatus[]> = {
  [DealStatus.pending_approval]: [
    DealStatus.rejected,
    DealStatus.in_progress,
    DealStatus.cancellation_requested,
    DealStatus.cancelled,
  ],
  [DealStatus.rejected]: [],
  [DealStatus.in_progress]: [
    DealStatus.work_completed_by_freelancer,
    DealStatus.result_sent_by_freelancer,
    DealStatus.cancellation_requested,
    DealStatus.in_dispute,
  ],
  [DealStatus.work_completed_by_freelancer]: [
    DealStatus.awaiting_review,
    DealStatus.cancellation_requested,
    DealStatus.in_dispute,
  ],
  [DealStatus.paid_by_customer]: [
    DealStatus.cancellation_requested,
    DealStatus.in_dispute,
  ],
  [DealStatus.payment_received_by_freelancer]: [
    DealStatus.cancellation_requested,
    DealStatus.in_dispute,
  ],
  [DealStatus.result_sent_by_freelancer]: [
    DealStatus.result_received_by_customer,
    DealStatus.awaiting_review,
    DealStatus.cancellation_requested,
    DealStatus.in_dispute,
  ],
  [DealStatus.result_received_by_customer]: [
    DealStatus.revision_requested,
    DealStatus.awaiting_review,
    DealStatus.cancellation_requested,
    DealStatus.in_dispute,
  ],
  [DealStatus.revision_requested]: [
    DealStatus.in_progress,
    DealStatus.cancellation_requested,
    DealStatus.in_dispute,
  ],
  [DealStatus.awaiting_review]: [
    DealStatus.completed,
    DealStatus.cancelled,
  ],
  [DealStatus.in_dispute]: [
    DealStatus.awaiting_review,
    DealStatus.cancelled,
    DealStatus.completed,
  ],
  [DealStatus.cancellation_requested]: [
    DealStatus.cancelled,
    DealStatus.awaiting_review,
    DealStatus.in_dispute,
  ],
  [DealStatus.cancelled]: [],
  [DealStatus.completed]: [],
};

export const canTransitionDeal = (from: DealStatus, to: DealStatus) =>
  DEAL_TRANSITIONS[from].includes(to);

const ESCROW_DEADLINE_PROTECTED_FREELANCER_TRANSITIONS = new Set<DealStatus>([
  DealStatus.work_completed_by_freelancer,
  DealStatus.result_sent_by_freelancer,
  DealStatus.cancellation_requested,
  DealStatus.in_dispute,
]);

export type DealTransitionPolicyViolation =
  | "payment_flow_mismatch"
  | "escrow_deadline_expired";

export const getDealTransitionPolicyViolation = ({
  fromStatus,
  toStatus,
  isEscrow,
  isFreelancer,
  plannedDeadlineAt,
  now,
}: {
  fromStatus: DealStatus;
  toStatus: DealStatus;
  isEscrow: boolean;
  isFreelancer: boolean;
  plannedDeadlineAt: Date | string | null | undefined;
  now: number;
}): DealTransitionPolicyViolation | null => {
  if (
    (isEscrow && toStatus === DealStatus.result_sent_by_freelancer) ||
    (!isEscrow && toStatus === DealStatus.work_completed_by_freelancer)
  ) {
    return "payment_flow_mismatch";
  }

  if (
    isEscrow &&
    isFreelancer &&
    fromStatus === DealStatus.in_progress &&
    ESCROW_DEADLINE_PROTECTED_FREELANCER_TRANSITIONS.has(toStatus) &&
    isDealDeadlineExpired(plannedDeadlineAt, now)
  ) {
    return "escrow_deadline_expired";
  }

  return null;
};
