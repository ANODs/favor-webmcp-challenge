import type { DealDto } from "@/entities/deal";
import { dealStatusMeta } from "@/entities/deal";
import { CompletedIcon, StatusPill, SurfaceCard } from "@/shared/ui";
import { useTranslations } from "next-intl";

type TimelineStepDef = {
  statuses: DealDto["status"][];
  labelKey: string;
  descKey: string;
};

// Simplified 5-step escrow deal timeline
const escrowSteps: TimelineStepDef[] = [
  {
    statuses: ["pending_approval"],
    labelKey: "escrow_step1_label",
    descKey: "escrow_step1_desc",
  },
  {
    statuses: ["in_progress"],
    labelKey: "escrow_step2_label",
    descKey: "escrow_step2_desc",
  },
  {
    statuses: [
      "work_completed_by_freelancer",
      "paid_by_customer",
      "payment_received_by_freelancer",
      "result_sent_by_freelancer",
      "result_received_by_customer",
    ],
    labelKey: "escrow_step3_label",
    descKey: "escrow_step3_desc",
  },
  {
    statuses: ["awaiting_review"],
    labelKey: "escrow_step4_label",
    descKey: "escrow_step4_desc",
  },
  {
    statuses: ["completed"],
    labelKey: "escrow_step5_label",
    descKey: "escrow_step5_desc",
  },
];

// Simplified 5-step direct deal timeline
const standardSteps: TimelineStepDef[] = [
  {
    statuses: ["pending_approval"],
    labelKey: "direct_step1_label",
    descKey: "direct_step1_desc",
  },
  {
    statuses: ["in_progress"],
    labelKey: "direct_step2_label",
    descKey: "direct_step2_desc",
  },
  {
    statuses: ["work_completed_by_freelancer", "result_sent_by_freelancer"],
    labelKey: "direct_step3_label",
    descKey: "direct_step3_desc",
  },
  {
    statuses: ["paid_by_customer", "payment_received_by_freelancer", "result_received_by_customer"],
    labelKey: "direct_step4_label",
    descKey: "direct_step4_desc",
  },
  {
    statuses: ["awaiting_review", "completed"],
    labelKey: "direct_step5_label",
    descKey: "direct_step5_desc",
  },
];

type Props = {
  status: DealDto["status"];
  isEscrow?: boolean;
};

export function DealStatusTimeline({ status, isEscrow = false }: Props) {
  const tStatus = useTranslations("DealStatuses");
  const tTimeline = useTranslations("DealTimeline");
  const steps = isEscrow ? escrowSteps : standardSteps;
  
  // Find which step index contains the current status
  const currentStepIndex = steps.findIndex((step) => step.statuses.includes(status));

  return (
    <SurfaceCard className="relative overflow-hidden rounded-[2rem]" paddingClassName="p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-extrabold tracking-[-0.02em] text-zinc-950">{tTimeline("title")}</h3>
          <p className="mt-1 text-xs font-medium leading-5 text-zinc-500">
            {isEscrow 
              ? tTimeline("escrow_desc") 
              : tTimeline("direct_desc")}
          </p>
        </div>
        <StatusPill
          label={tStatus(dealStatusMeta[status].labelKey)}
          tone={dealStatusMeta[status].tone}
        />
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-white/12">
        {steps.map((step, index) => {
          const isCurrent = index === currentStepIndex;
          const isPassed = index < currentStepIndex;

          return (
            <div
              key={index}
              className={`relative px-4 py-4 transition-colors ${index > 0 ? "border-t border-zinc-200 dark:border-white/12" : ""} ${
                isCurrent
                  ? "bg-zinc-900 text-white dark:bg-zinc-800 dark:text-white"
                  : isPassed
                    ? "text-zinc-700 dark:text-zinc-200"
                    : "text-zinc-400 dark:text-zinc-600"
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-extrabold ${
                    isCurrent
                      ? "border-white/25 bg-white/10 text-white dark:border-white/20 dark:bg-white/10 dark:text-white"
                      : isPassed
                        ? "border-[#0f8c5c]/30 bg-[#0f8c5c]/10 text-[#0f8c5c] dark:border-brand-accent/30 dark:bg-brand-accent/10 dark:text-brand-accent"
                        : "border-zinc-200 text-zinc-400 dark:border-white/12 dark:text-zinc-600"
                  }`}
                >
                  {isPassed ? <CompletedIcon className="h-4 w-4" /> : index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-extrabold">{tTimeline(step.labelKey as never)}</p>
                    {isCurrent ? (
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">
                        {tTimeline("current")}
                      </span>
                    ) : isPassed ? (
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#0f8c5c] dark:text-brand-accent">
                        {tTimeline("completed")}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs font-medium leading-5 opacity-75">
                    {tTimeline(step.descKey as never)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </SurfaceCard>
  );
}
