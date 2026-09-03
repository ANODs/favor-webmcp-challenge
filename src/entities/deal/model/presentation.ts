import type { DealDto } from "../api/dto";
import { DEAL_TRANSITIONS } from "./status";
import { isDealDeadlineExpired } from "./timing";

type DealRole = "customer" | "freelancer";

const freelancerOnlyStatuses = new Set<DealDto["status"]>([
  "work_completed_by_freelancer",
  "payment_received_by_freelancer",
  "result_sent_by_freelancer",
]);

const customerOnlyStatuses = new Set<DealDto["status"]>([
  "paid_by_customer",
  "result_received_by_customer",
  "revision_requested",
  "awaiting_review",
]);

export const dealStatusMeta: Record<
  DealDto["status"],
  {
    labelKey: string;
    tone: "neutral" | "success" | "warning" | "danger" | "info";
  }
> = {
  pending_approval: { labelKey: "status_pending_approval", tone: "warning" },
  rejected: { labelKey: "status_rejected", tone: "danger" },
  in_progress: { labelKey: "status_in_progress", tone: "info" },
  work_completed_by_freelancer: {
    labelKey: "status_work_completed_by_freelancer",
    tone: "info",
  },
  paid_by_customer: { labelKey: "status_paid_by_customer", tone: "info" },
  payment_received_by_freelancer: {
    labelKey: "status_payment_received_by_freelancer",
    tone: "info",
  },
  result_sent_by_freelancer: {
    labelKey: "status_result_sent_by_freelancer",
    tone: "info",
  },
  result_received_by_customer: {
    labelKey: "status_result_received_by_customer",
    tone: "info",
  },
  revision_requested: { labelKey: "status_revision_requested", tone: "warning" },
  awaiting_review: { labelKey: "status_awaiting_review", tone: "warning" },
  in_dispute: { labelKey: "status_in_dispute", tone: "danger" },
  cancellation_requested: {
    labelKey: "status_cancellation_requested",
    tone: "danger",
  },
  cancelled: { labelKey: "status_cancelled", tone: "danger" },
  completed: { labelKey: "status_completed", tone: "success" },
};

export const dealTransitionLabels: Record<
  DealDto["status"],
  { labelKey: string }
> = {
  pending_approval: { labelKey: "transition_pending_approval" },
  rejected: { labelKey: "transition_rejected" },
  in_progress: { labelKey: "transition_in_progress" },
  work_completed_by_freelancer: {
    labelKey: "transition_work_completed_by_freelancer",
  },
  paid_by_customer: { labelKey: "transition_paid_by_customer" },
  payment_received_by_freelancer: {
    labelKey: "transition_payment_received_by_freelancer",
  },
  result_sent_by_freelancer: {
    labelKey: "transition_result_sent_by_freelancer",
  },
  result_received_by_customer: {
    labelKey: "transition_result_received_by_customer",
  },
  revision_requested: { labelKey: "transition_revision_requested" },
  awaiting_review: { labelKey: "transition_awaiting_review" },
  in_dispute: { labelKey: "transition_in_dispute" },
  cancellation_requested: { labelKey: "transition_cancellation_requested" },
  cancelled: { labelKey: "transition_cancelled" },
  completed: { labelKey: "transition_completed" },
};

export const getParticipantRole = (deal: DealDto, userId?: number | null): DealRole | null => {
  if (!userId) {
    return null;
  }

  if (deal.customerId === userId) {
    return "customer";
  }

  if (deal.freelancerId === userId) {
    return "freelancer";
  }

  return null;
};

export const getAvailableDealTransitions = (deal: DealDto, userId?: number | null) => {
  const role = getParticipantRole(deal, userId);

  if (!role) {
    return [];
  }

  return DEAL_TRANSITIONS[deal.status].filter((status) => {
    if (deal.status === "in_progress") {
      if (deal.isEscrow && status === "result_sent_by_freelancer") {
        return false;
      }

      if (!deal.isEscrow && status === "work_completed_by_freelancer") {
        return false;
      }
    }

    if (freelancerOnlyStatuses.has(status)) {
      return role === "freelancer";
    }

    if (customerOnlyStatuses.has(status)) {
      return role === "customer";
    }

    return true;
  });
};

export const getDealCounterpart = (deal: DealDto, userId?: number | null) => {
  const role = getParticipantRole(deal, userId);
  
  if (role === "customer") {
    return deal.freelancer ?? null;
  }
  
  if (role === "freelancer") {
    return deal.customer ?? null;
  }
  
  return null;
};

export const getDealTimeStatus = (deal: DealDto, now = Date.now()) => {

  const isAwaitingPayment = deal.status === "pending_approval" || (deal.isEscrow && !deal.paidByCustomer && deal.status !== "cancelled" && deal.status !== "rejected" && deal.status !== "completed");

  const paymentExpiresAtMs = deal.paymentExpiresAt ? new Date(deal.paymentExpiresAt).getTime() : null;
  const isPaymentExpiringSoon = isAwaitingPayment && paymentExpiresAtMs !== null && paymentExpiresAtMs - now <= 2 * 3600 * 1000 && paymentExpiresAtMs > now;
  const isPaymentExpired = isAwaitingPayment && paymentExpiresAtMs !== null && paymentExpiresAtMs <= now;

  const deadlineAtMs = deal.plannedDeadlineAt ? new Date(deal.plannedDeadlineAt).getTime() : null;
  const isOverdue =
    deal.status === "in_progress" &&
    isDealDeadlineExpired(deal.plannedDeadlineAt, now);
  const isDeadlineApproaching = deal.status === "in_progress" && deadlineAtMs !== null && deadlineAtMs - now <= 24 * 3600 * 1000 && deadlineAtMs > now;

  let progressPercent = 0;
  if (deal.status === "completed") {
    progressPercent = 100;
  } else if (deal.plannedStartedAt && deal.plannedDeadlineAt) {
    const startedMs = new Date(deal.plannedStartedAt).getTime();
    const totalMs = deadlineAtMs! - startedMs;
    if (totalMs > 0) {
      const elapsedMs = Math.max(0, now - startedMs);
      progressPercent = Math.min(100, Math.round((elapsedMs / totalMs) * 100));
    }
  }

  return {
    isAwaitingPayment,
    paymentExpiresAtMs,
    isPaymentExpiringSoon,
    isPaymentExpired,
    deadlineAtMs,
    isOverdue,
    isDeadlineApproaching,
    progressPercent,
  };
};
