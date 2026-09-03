import type { DealDto } from "../api/dto";

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export const getDealExecutionTiming = ({
  deadlineDays,
  activatedAt,
  plannedStartedAt,
  plannedDeadlineAt,
}: {
  deadlineDays: number | null;
  activatedAt: Date;
  plannedStartedAt?: Date | null;
  plannedDeadlineAt?: Date | null;
}) => {
  const startedAt = plannedStartedAt ?? activatedAt;
  const deadlineAt =
    plannedDeadlineAt ??
    (deadlineDays
      ? new Date(startedAt.getTime() + deadlineDays * DAY_IN_MILLISECONDS)
      : null);

  return { startedAt, deadlineAt };
};

export const getEscrowDeadlineDurationSeconds = (
  deadlineDays: number | null,
) => (deadlineDays ? deadlineDays * 24 * 60 * 60 : 0);

export const isDealExecutionActive = (status: DealDto["status"]) =>
  status === "in_progress";

export const isDealDeadlineExpired = (
  plannedDeadlineAt: Date | string | null | undefined,
  now = Date.now(),
) =>
  plannedDeadlineAt !== null &&
  plannedDeadlineAt !== undefined &&
  new Date(plannedDeadlineAt).getTime() <= now;
