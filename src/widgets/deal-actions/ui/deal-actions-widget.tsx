"use client";

import {
  TonConnectButton,
  useTonAddress,
  useTonWallet,
} from "@tonconnect/ui-react";
import { Unbounded } from "next/font/google";
import { Button, EmptyState, SurfaceCard } from "@/shared/ui";
import {
  CustomerEscrowPaymentBlock,
  FreelancerWalletConnectBlock,
  useEscrowActions,
} from "@/features/deal-escrow";
import {
  ModeratorArbitrationPanel,
  RaiseDisputeButton,
  useArbitrationActions,
} from "@/features/deal-arbitration";
import { DealTransitionsList } from "@/features/deal-transitions";
import { useTranslations } from "next-intl";
import { getDealTimeStatus, type DealDto } from "@/entities/deal";
import type { UserDto } from "@/entities/user";
import { areTonAddressesEqual } from "@/shared/lib/ton";

type DealTransitionMutation = {
  mutate: (status: DealDto["status"]) => void;
  mutateAsync: (status: DealDto["status"]) => Promise<unknown>;
  isPending: boolean;
  variables?: string;
};

type Props = {
  deal: DealDto;
  me: UserDto | null | undefined;
  refetch: () => Promise<unknown>;
  availableTransitions: DealDto["status"][];
  transitionMutation: DealTransitionMutation;
  now: number | null;
};

const unbounded = Unbounded({ subsets: ["latin", "cyrillic"] });
const actionTitleClassName = `${unbounded.className} text-lg font-extrabold tracking-[-0.035em] text-zinc-950`;

export function DealActionsWidget({ deal, me, refetch, availableTransitions, transitionMutation, now }: Props) {
  const t = useTranslations("DealActions");
  const tonAddress = useTonAddress();
  const tonWallet = useTonWallet();
  const isCustomer = deal.customerId === me?.id;
  const isFreelancer = deal.freelancerId === me?.id;
  const isModerator = me?.role === "moderator";
  const contractSnapshot = deal.contractSnapshot;
  const contractType = contractSnapshot?.type || deal.contract?.type || "order";

  const {
    loadingText: escrowLoadingText,
    actionError: escrowActionError,
    handleLockEscrow,
    handleReleaseEscrow,
    handleEscrowRefund,
    verifyEscrowMutation,
    updateDealMutation,
    setActionError: setEscrowActionError
  } = useEscrowActions({ deal, tonAddress, refetch, transitionMutation });

  const {
    loadingText: arbLoadingText,
    actionError: arbActionError,
    handleRaiseDispute,
    handleArbitrationResolve
  } = useArbitrationActions({ deal, refetch, transitionMutation });

  const loadingText = escrowLoadingText || arbLoadingText;
  const actionError = escrowActionError || arbActionError;
  const hasReviewed = deal.reviews?.some((review) => review.reviewerId === me?.id);
  const { isOverdue } = getDealTimeStatus(deal, now ?? 0);
  const hasCustomerDeadlineRefund =
    now !== null && isCustomer && isOverdue && (deal.escrowVersion ?? 1) >= 2;
  const needsLegacyDeadlineArbitration =
    now !== null && isCustomer && isOverdue && (deal.escrowVersion ?? 1) < 2;
  const hasRefundWallet = Boolean(tonWallet && tonAddress);
  const isRefundWalletCorrect = Boolean(
    hasRefundWallet &&
      (!deal.escrowCustomerWalletAddress ||
        areTonAddressesEqual(
          tonAddress,
          deal.escrowCustomerWalletAddress,
        )),
  );
  const isFreelancerRefundWalletCorrect = Boolean(
    hasRefundWallet &&
      (!deal.freelancer?.walletAddress ||
        areTonAddressesEqual(tonAddress, deal.freelancer.walletAddress)),
  );

  // Render direct calculation
  if (!deal.isEscrow) {
    return (
      <SurfaceCard id="deal-actions" className="relative scroll-mt-4 rounded-[2rem]" paddingClassName="p-4 sm:p-6">
        <h3 className={actionTitleClassName}>{t("available_actions")}</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {t("direct_deal_desc")}
        </p>

        {actionError && (
          <div className="mt-3 rounded-xl bg-red-500/10 p-3 border border-red-500/20 text-xs text-red-700 dark:text-red-400">
            {actionError}
          </div>
        )}

        {availableTransitions.length > 0 && !loadingText && (
          <>
            {isFreelancer && deal.status === "in_progress" && availableTransitions.includes("result_sent_by_freelancer") && (
              <div className="mb-3 rounded-xl bg-amber-500/10 p-4 border border-amber-500/20 text-center">
                <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                  {t("upload_warning")}
                </p>
              </div>
            )}
            <DealTransitionsList availableTransitions={availableTransitions} transitionMutation={transitionMutation} />
          </>
        )}

        {deal.status === "awaiting_review" && !loadingText && (
          <div className="mt-4">
            <div className="rounded-xl bg-blue-500/10 p-4 border border-blue-500/20 text-center shadow-sm">
              <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-1">
                {t("mandatory_review_stage")}
              </h4>
              <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                {hasReviewed 
                  ? t("already_reviewed")
                  : t("exchange_reviews")}
              </p>
            </div>
          </div>
        )}

        {availableTransitions.length === 0 && !loadingText && deal.status !== "awaiting_review" && (
          <div className="mt-4">
            <EmptyState
              title={t("no_actions")}
              description={t("no_actions_required")}
            />
          </div>
        )}
      </SurfaceCard>
    );
  }

  // Render Escrow
  return (
    <SurfaceCard id="deal-actions" className="relative scroll-mt-4 rounded-[2rem]" paddingClassName="p-4 sm:p-6">
      <h3 className={actionTitleClassName}>{t("available_actions")}</h3>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {t("escrow_deal_desc")}
      </p>

      {actionError && (
        <div className="mt-3 rounded-xl bg-red-500/10 p-3 border border-red-500/20 text-xs text-red-700 dark:text-red-400">
          {actionError}
        </div>
      )}

      {loadingText && (
        <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-blue-500/10 p-4 border border-blue-500/20 text-sm font-semibold text-blue-700 dark:text-blue-300">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-700 border-t-transparent dark:border-blue-300"></div>
          {loadingText}
        </div>
      )}

      {/* Customer Initial */}
      {deal.status === "pending_approval" && isCustomer && !loadingText && (
        (() => {
          if (!deal.freelancer?.walletAddress) {
            return (
              <div className="mt-4 flex flex-col gap-4">
                <div className="flex flex-col gap-3 rounded-2xl bg-amber-500/10 p-5 border border-amber-500/20 shadow-md">
                  <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    {t("waiting_for_contractor")}
                  </h4>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-normal">
                    {t("waiting_for_contractor_desc")}
                  </p>
                </div>
                {availableTransitions.includes("rejected") && (
                  <DealTransitionsList availableTransitions={["rejected"]} transitionMutation={transitionMutation} />
                )}
              </div>
            );
          }

          if (contractType === "offer" && !deal.escrowState) {
            return (
              <div className="mt-4 flex flex-col gap-4">
                <div className="flex flex-col gap-3 rounded-2xl bg-amber-500/10 p-5 border border-amber-500/20 shadow-md">
                  <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    {t("waiting_for_confirmation")}
                  </h4>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-normal">
                    {t("accept_first_desc")}
                  </p>
                </div>
                {availableTransitions.includes("rejected") && (
                  <DealTransitionsList availableTransitions={["rejected"]} transitionMutation={transitionMutation} />
                )}
              </div>
            );
          }

          return (
            <div className="mt-4 flex flex-col gap-4">
              <CustomerEscrowPaymentBlock 
                deal={deal} 
                tonWallet={tonWallet} 
                loadingText={loadingText} 
                handleLockEscrow={handleLockEscrow} 
                verifyEscrowMutation={verifyEscrowMutation} 
                setActionError={setEscrowActionError} 
              />
              {availableTransitions.includes("rejected") && (
                <DealTransitionsList availableTransitions={["rejected"]} transitionMutation={transitionMutation} />
              )}
            </div>
          );
        })()
      )}

      {/* Freelancer Initial */}
      {deal.status === "pending_approval" && isFreelancer && !loadingText && (
        (() => {
          if (!deal.freelancer?.walletAddress) {
            return <FreelancerWalletConnectBlock transitionMutation={transitionMutation} availableTransitions={availableTransitions} />;
          }

          if (contractType === "offer" && !deal.escrowState) {
            return (
              <div className="mt-4 flex flex-col gap-4">
                <div className="flex flex-col gap-3 rounded-2xl bg-blue-500/10 p-5 border border-blue-500/20 shadow-md">
                  <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                    {t("new_proposal_received")}
                  </h4>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-normal">
                    {t("customer_proposes")}
                  </p>
                  <p className="text-[10px] font-mono text-zinc-500 break-all mt-2 bg-zinc-900/5 dark:bg-black/20 p-2 rounded-lg">
                    {t("payout_address", { address: deal.freelancer.walletAddress })}
                  </p>
                  <div className="mt-2 flex gap-3">
                    <Button
                      onClick={() => updateDealMutation.mutate({ escrowState: "approved" })}
                      loading={updateDealMutation.isPending}
                      variant="primary"
                      shape="rounded-2xl"
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex-1"
                    >
                      {t("accept_deal_btn")}
                    </Button>
                  </div>
                </div>
                {availableTransitions.includes("rejected") && (
                  <DealTransitionsList availableTransitions={["rejected"]} transitionMutation={transitionMutation} />
                )}
              </div>
            );
          }

          return (
            <div className="mt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-2 rounded-2xl bg-blue-500/10 p-5 border border-blue-500/20 shadow-md">
                <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                  {t("waiting_for_payment_title")}
                </h4>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-normal">
                  {t("waiting_for_payment")} 
                  {t("waiting_for_payment_desc2")}
                </p>
                <p className="text-[10px] font-mono text-zinc-500 break-all mt-2 bg-zinc-900/5 dark:bg-black/20 p-2 rounded-lg">
                  {t("address", { address: deal.freelancer.walletAddress })}
                </p>
              </div>
              {availableTransitions.includes("rejected") && (
                <DealTransitionsList availableTransitions={["rejected"]} transitionMutation={transitionMutation} />
              )}
            </div>
          );
        })()
      )}

      {/* Customer Accept Results */}
      {deal.status === "work_completed_by_freelancer" && isCustomer && !loadingText && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="rounded-xl bg-indigo-500/10 p-4 border border-indigo-500/20 text-center">
            <p className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">
              {t("check_results_desc")}
            </p>
          </div>
          <Button
            onClick={handleReleaseEscrow}
            variant="primary"
            shape="rounded-2xl"
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            fullWidth
          >
            {t("accept_and_pay")}
          </Button>
          <RaiseDisputeButton handleRaiseDispute={handleRaiseDispute} loading={loadingText !== ""} />
        </div>
      )}

      {deal.status === "in_progress" && isCustomer && !loadingText && (
        hasCustomerDeadlineRefund ? (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-red-500/25 bg-red-500/10 p-5 shadow-md">
            <div>
              <h4 className="text-sm font-bold text-red-800 dark:text-red-300">
                {t("deadline_refund_title")}
              </h4>
              <p className="mt-1 text-xs leading-normal text-zinc-700 dark:text-zinc-300">
                {t("deadline_refund_desc")}
              </p>
            </div>
            {isRefundWalletCorrect ? (
              <Button
                onClick={() => handleEscrowRefund("customer")}
                variant="primary"
                shape="rounded-2xl"
                className="bg-red-600 font-bold text-white hover:bg-red-500"
                fullWidth
              >
                {t("return_funds")}
              </Button>
            ) : (
              <div className="rounded-xl border border-amber-500/25 bg-white/70 p-3 text-center dark:bg-zinc-950/40">
                <p className="mb-3 text-xs font-medium text-amber-800 dark:text-amber-300">
                  {hasRefundWallet
                    ? t("switch_refund_wallet")
                    : t("connect_refund_wallet")}
                </p>
                <TonConnectButton className="mx-auto" />
              </div>
            )}
          </div>
        ) : needsLegacyDeadlineArbitration ? (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5 shadow-md">
            <div>
              <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300">
                {t("legacy_deadline_title")}
              </h4>
              <p className="mt-1 text-xs leading-normal text-zinc-700 dark:text-zinc-300">
                {t("legacy_deadline_desc")}
              </p>
            </div>
            <RaiseDisputeButton handleRaiseDispute={handleRaiseDispute} loading={false} />
          </div>
        ) : (
          <div className="mt-4 rounded-2xl bg-blue-500/10 p-5 border border-blue-500/20 shadow-md">
            <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
              {t("work_in_progress")}
            </h4>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-normal mt-1">
              {t("work_in_progress_desc")}
              {t("freelancer_upload_wait")}
            </p>
          </div>
        )
      )}

      {deal.status === "work_completed_by_freelancer" && isFreelancer && !loadingText && (
        <div className="mt-4 rounded-2xl bg-indigo-500/10 p-5 border border-indigo-500/20 shadow-md">
          <h4 className="text-sm font-bold text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5">
            {t("work_in_review")}
          </h4>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-normal mt-1">
            {t("work_in_review_desc1")}
            {t("work_in_review_desc2")}
          </p>
        </div>
      )}

      {/* Freelancer refund */}
      {deal.status === "in_progress" && isFreelancer && !loadingText && (
        <div className="mt-4 flex flex-col gap-3">
          {availableTransitions.includes("work_completed_by_freelancer") && (
            <>
              <div className="rounded-xl bg-amber-500/10 p-4 border border-amber-500/20 text-center shadow-sm">
                <p className="text-xs text-amber-700 dark:text-amber-300 font-medium leading-relaxed">
                  {t("dispute_warning")}
                </p>
              </div>
              <DealTransitionsList availableTransitions={["work_completed_by_freelancer"]} transitionMutation={transitionMutation} />
            </>
          )}
          {isFreelancerRefundWalletCorrect ? (
            <Button
              onClick={() => handleEscrowRefund("freelancer")}
              variant="primary"
              shape="rounded-2xl"
              className="border border-zinc-200 bg-transparent text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              fullWidth
            >
              {t("refund_100")}
            </Button>
          ) : (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
              <p className="mb-3 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                {hasRefundWallet
                  ? t("switch_freelancer_refund_wallet")
                  : t("connect_freelancer_refund_wallet")}
              </p>
              <TonConnectButton className="mx-auto" />
            </div>
          )}
        </div>
      )}

      {/* Moderator Panel */}
      {isModerator && (deal.status === "in_dispute" || deal.status === "cancellation_requested") && !loadingText && (
        <ModeratorArbitrationPanel handleArbitrationResolve={handleArbitrationResolve} loading={loadingText !== ""} />
      )}

      {/* Customer recovery flows */}
      {isCustomer && ["paid_by_customer", "payment_received_by_freelancer", "result_sent_by_freelancer", "result_received_by_customer"].includes(deal.status) && !loadingText && (
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-2xl bg-amber-500/10 p-5 border border-amber-500/20 shadow-md">
            <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
              {t("funds_being_paid")}
            </h4>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-normal">
              {t("funds_being_paid_desc")}
            </p>
            {deal.escrowAddress && (
              <p className="text-[10px] font-mono text-zinc-500 break-all bg-zinc-900/5 dark:bg-black/20 p-2 rounded-lg">
                {t("escrow_contract", { address: deal.escrowAddress })}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <Button
              onClick={handleReleaseEscrow}
              variant="primary"
              shape="rounded-2xl"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg"
              fullWidth
            >
              {t("retry_payout")}
            </Button>
            {availableTransitions.includes("awaiting_review") && (
              <DealTransitionsList availableTransitions={["awaiting_review"]} transitionMutation={transitionMutation} />
            )}
            <RaiseDisputeButton handleRaiseDispute={handleRaiseDispute} loading={loadingText !== ""} />
          </div>
        </div>
      )}

      {/* Freelancer recovery flows */}
      {isFreelancer && ["paid_by_customer", "payment_received_by_freelancer", "result_sent_by_freelancer", "result_received_by_customer"].includes(deal.status) && !loadingText && (
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-2xl bg-indigo-500/10 p-5 border border-indigo-500/20 shadow-md">
            <h4 className="text-sm font-bold text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5">
              {t("waiting_payout_title")}
            </h4>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-normal">
              {t("waiting_blockchain")}
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <RaiseDisputeButton handleRaiseDispute={handleRaiseDispute} loading={loadingText !== ""} />
            {availableTransitions.includes("awaiting_review") && (
              <DealTransitionsList availableTransitions={["awaiting_review"]} transitionMutation={transitionMutation} />
            )}
          </div>
        </div>
      )}

      {deal.status === "awaiting_review" && !loadingText && (
        <div className="mt-4">
          <div className="rounded-xl bg-blue-500/10 p-5 border border-blue-500/20 text-center shadow-md">
            <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300 flex items-center justify-center gap-1.5 mb-2">
              {t("mandatory_review_stage")}
            </h4>
            <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
              {hasReviewed 
                ? t("already_reviewed")
                : t("exchange_reviews")}
            </p>
          </div>
        </div>
      )}

      {availableTransitions.length === 0 && !loadingText && deal.status !== "pending_approval" && deal.status !== "awaiting_review" && (
        <div className="mt-4">
          <EmptyState
            title={t("no_actions")}
            description={t("no_actions_required")}
          />
        </div>
      )}
    </SurfaceCard>
  );
}
