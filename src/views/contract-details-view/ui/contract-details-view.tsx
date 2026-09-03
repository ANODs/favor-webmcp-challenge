"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Unbounded } from "next/font/google";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { useRef, useState } from "react";

import {
  canManageContract,
  contractQueryKeys,
  contractsClient,
  getContractOfferTexts,
} from "@/entities/contract";
import { ContractAiModerationInsights } from "@/entities/contract/ui";
import {
  isTelegramBotChatRequiredError,
  TELEGRAM_BOT_ACCESS_ERROR_CODES,
} from "@/entities/user";
import { TelegramBotAccessNotice } from "@/entities/user/ui";
import { ClaimContractWidget } from "@/features/claim-contract";
import { authClient, sessionQueryKeys } from "@/entities/session";
import { moderationClient } from "@/features/contract-ai-moderation/client";
import {
  DealProposalFields,
  getDealProposalValidation,
  initiateContractDealClient,
  type DealBriefResourceDraft,
} from "@/features/initiate-contract-deal";
import { routes } from "@/shared/config/routes";
import {
  buildContractDealIntentStartParam,
  buildContractStartParam,
  requestTelegramWriteAccess,
} from "@/shared/lib/telegram";
import { ApiRequestError } from "@/shared/api";
import { useGuestLock } from "@/shared/lib/use-guest-lock";
import {
  ActionCard,
  ActionCardButton,
  ActionCardLink,
  ActionDialog,
  Button,
  ConfirmationDialog,
  GuestLockDialog,
  ResponsiveSelect,
  Skeleton,
  SurfaceCard,
  TelegramBotButton,
} from "@/shared/ui";
import { ContractDetails } from "@/widgets/contract-details";
import { CategoryPromotionControl } from "@/features/category-auction";

declare global {
  interface Window {
    Adsgram?: {
      init(config: { blockId: string }): {
        show(): Promise<{ done: boolean; description: string; state: string; error: boolean }>;
      };
    };
  }
}

type Props = {
  slug: string;
  botUsername: string;
  dealIntent?: boolean;
};

type ContractStatusAction = "" | "active" | "archived" | "pending_moderation";
type ConfirmedContractStatusAction = Exclude<ContractStatusAction, "">;

const unbounded = Unbounded({ subsets: ["latin", "cyrillic"] });

export function ContractDetailsView({
  slug,
  botUsername,
  dealIntent = false,
}: Props) {
  const tDetails = useTranslations("ContractDetails");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isOfferPopupOpen, setIsOfferPopupOpen] = useState(false);
  const [details, setDetails] = useState("");
  const [priceDraft, setPriceDraft] = useState<string | null>(null);
  const [deadlineDaysDraft, setDeadlineDaysDraft] = useState<string | null>(null);
  const [briefResources, setBriefResources] = useState<
    DealBriefResourceDraft[]
  >([{ url: "", label: "" }]);
  const [focusedContractSection, setFocusedContractSection] = useState<
    "questions" | null
  >(null);
  const [dismissedDealIntentSlug, setDismissedDealIntentSlug] = useState<
    string | null
  >(null);
  const [statusAction, setStatusAction] = useState<ContractStatusAction>("");
  const [statusActionToConfirm, setStatusActionToConfirm] =
    useState<ConfirmedContractStatusAction | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [initiateErrorMessage, setInitiateErrorMessage] = useState("");
  const [initiateErrorCode, setInitiateErrorCode] = useState<string>();
  const [isInitiating, setIsInitiating] = useState(false);
  const [isRecoveryAccessPending, setIsRecoveryAccessPending] =
    useState(false);
  const initiateAttemptRef = useRef(false);
  const [adPending, setAdPending] = useState(false);

  const meQuery = useQuery({
    queryKey: sessionQueryKeys.currentUser,
    queryFn: authClient.getMe,
  });
  const contractQuery = useQuery({
    queryKey: contractQueryKeys.detail(slug),
    queryFn: () => contractsClient.getBySlug(slug),
  });

  const initiateMutation = useMutation({
    mutationFn: () =>
      initiateContractDealClient.create(slug, {
        details: details.trim(),
        price: price !== "" ? Number(price) : undefined,
        deadlineDays: deadlineDays ? Number(deadlineDays) : undefined,
        briefResources: proposalValidation.resources,
      }),
    onSuccess: (deal) => {
      setInitiateErrorMessage("");
      setInitiateErrorCode(undefined);
      router.push(routes.dealById(deal.id));
    },
    onError: (error) => {
      setInitiateErrorCode(
        error instanceof ApiRequestError ? error.code : undefined,
      );
      setInitiateErrorMessage(tDetails("ErrorInitiateDeal"));
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => contractsClient.archive(slug),
    onSuccess: () => {
      setErrorMessage("");
      setStatusAction("");
      setStatusActionToConfirm(null);
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.detail(slug) });
      void queryClient.invalidateQueries({ queryKey: contractQueryKeys.all });
      router.push(routes.feed);
    },
    onError: () => {
      setErrorMessage(tDetails("ErrorArchiveContract"));
    },
  });

  const restoreMutation = useMutation({
    mutationFn: () => contractsClient.restore(slug),
    onSuccess: async () => {
      setErrorMessage("");
      setStatusAction("");
      setStatusActionToConfirm(null);
      await queryClient.invalidateQueries({ queryKey: contractQueryKeys.detail(slug) });
      await queryClient.invalidateQueries({ queryKey: contractQueryKeys.all });
    },
    onError: () => {
      setErrorMessage(tDetails("ErrorRestoreContract"));
    },
  });

  const publishMutation = useMutation({
    mutationFn: (id: number) => moderationClient.approveContract(id),
    onSuccess: async () => {
      setErrorMessage("");
      setStatusAction("");
      setStatusActionToConfirm(null);
      await queryClient.invalidateQueries({ queryKey: contractQueryKeys.detail(slug) });
      await queryClient.invalidateQueries({ queryKey: contractQueryKeys.all });
    },
    onError: () => {
      setErrorMessage(tDetails("ErrorPublishContract"));
    },
  });

  const revealMutation = useMutation({
    mutationFn: () => contractsClient.reveal(slug),
    onSuccess: async () => {
      setErrorMessage("");
      await queryClient.invalidateQueries({ queryKey: contractQueryKeys.detail(slug) });
      await queryClient.invalidateQueries({ queryKey: sessionQueryKeys.currentUser });
    },
    onError: () => {
      setErrorMessage(tDetails("ErrorRevealContacts"));
    },
  });

  const handleRevealAd = async () => {
    if (!window.Adsgram) {
      setErrorMessage(tDetails("AdBlocked"));
      return;
    }

    try {
      setErrorMessage("");
      setAdPending(true);
      
      const AdController = window.Adsgram.init({ blockId: "29488" });
      const result = await AdController.show();
      
      if (result.done) {
        // Now that the backend webhook gets called, it might take a second.
        // Let's just blindly call reveal and let it retry or assume it worked.
        // Wait 1 second to give webhook time to arrive
        await new Promise(resolve => setTimeout(resolve, 1000));
        revealMutation.mutate();
      }
    } catch (err) {
      console.warn("Ad view rejected or failed", err);
      // AdsGram rejects the promise if user skips or if there's an error.
      setErrorMessage(tDetails("AdIncomplete"));
    } finally {
      setAdPending(false);
    }
  };

  const contract = contractQuery.data;
  const initialPrice =
    contract?.basePrice === null || contract?.basePrice === undefined
      ? ""
      : String(contract.basePrice);
  const initialDeadlineDays =
    contract?.deadlineDays === null || contract?.deadlineDays === undefined
      ? ""
      : String(contract.deadlineDays);
  const price = priceDraft ?? initialPrice;
  const deadlineDays = deadlineDaysDraft ?? initialDeadlineDays;
  const proposalValidation = getDealProposalValidation({
    details,
    price,
    deadlineDays,
    resources: briefResources,
    isEscrow: contract?.isEscrow ?? false,
  });
  const isAuthor = contract && meQuery.data?.id === contract.authorId;
  const isModerator = meQuery.data?.role === "moderator";
  const canEdit = canManageContract(contract, meQuery.data);
  const isClaimable =
    contract &&
    contract.scoutId != null &&
    contract.authorId === contract.scoutId &&
    (contract.status === "active" || contract.status === "pending_verification");
  const canInitiate = Boolean(
    contract &&
      !isClaimable &&
      meQuery.data &&
      contract.status === "active" &&
      contract.authorId !== meQuery.data.id,
  );
  const canPublish = isModerator && contract?.status === "pending_moderation";
  const canArchive = canEdit && contract?.status !== "archived";
  const canRestoreToModeration = canEdit && contract?.status === "archived";
  const hasStatusActions = canPublish || canArchive || canRestoreToModeration;
  const statusActionOptions: Array<{ value: Exclude<ContractStatusAction, "">; label: string }> = [
    ...(canPublish
      ? [{ value: "active" as const, label: tDetails("PublishContract") }]
      : []),
    ...(canArchive
      ? [{ value: "archived" as const, label: tDetails("ArchiveContract") }]
      : []),
    ...(canRestoreToModeration
      ? [
          {
            value: "pending_moderation" as const,
            label: tDetails("RestoreToModeration"),
          },
        ]
      : []),
  ];
  const showContractStatus = Boolean(canEdit);
  const statusMutationPending =
    publishMutation.isPending || archiveMutation.isPending || restoreMutation.isPending;
  const statusConfirmation =
    statusActionToConfirm === "active"
      ? {
          description: tDetails("PublishConfirmation"),
          confirmLabel: tDetails("PublishContract"),
          pendingLabel: tDetails("PublishingContract"),
        }
      : statusActionToConfirm === "archived"
        ? {
            description: tDetails("ArchiveConfirmation"),
            confirmLabel: tDetails("ArchiveContract"),
            pendingLabel: tDetails("ArchivingContract"),
          }
        : statusActionToConfirm === "pending_moderation"
          ? {
              description: tDetails("RestoreConfirmation"),
              confirmLabel: tDetails("RestoreToModeration"),
              pendingLabel: tDetails("RestoringContract"),
            }
          : null;
  const isGuest = !meQuery.isLoading && !meQuery.data;

  const {
    isLocked,
    lockedItemLabel,
    telegramContinueUrl,
    handleRequireAuth,
    closeLock,
  } = useGuestLock(botUsername);

  const offerTexts = getContractOfferTexts(
    contract?.type || "offer",
    isGuest,
    Boolean(isClaimable),
    {
      proposalTitle: tDetails("OfferProposalTitle"),
      startTitle: tDetails("OfferStartTitle"),
      guestDescription: tDetails("OfferGuestDescription"),
      claimableDescription: tDetails("OfferClaimableDescription"),
      orderDescription: tDetails("OfferOrderDescription"),
      offerDescription: tDetails("OfferServiceDescription"),
      orderMessagePlaceholder: tDetails("OfferOrderMessagePlaceholder"),
      offerMessagePlaceholder: tDetails("OfferServiceMessagePlaceholder"),
      orderSubmitLabel: tDetails("OfferOrderSubmit"),
      offerSubmitLabel: tDetails("OfferStartSubmit"),
    },
  );

  const showOfferAction = Boolean(
    contract &&
      !isAuthor &&
      !isClaimable &&
      contract.status === "active"
  );
  const isDealIntentOpen =
    dealIntent && canInitiate && dismissedDealIntentSlug !== slug;
  const isOfferDialogOpen = Boolean(
    contract && (isOfferPopupOpen || isDealIntentOpen),
  );

  const handleOfferClick = () => {
    if (isGuest && contract) {
      handleRequireAuth({
        label: offerTexts.title,
        startApp: dealIntent
          ? buildContractDealIntentStartParam(contract.slug)
          : buildContractStartParam(contract.slug),
      });
      return;
    }
    setErrorMessage("");
    setInitiateErrorMessage("");
    setInitiateErrorCode(undefined);
    setIsOfferPopupOpen(true);
  };

  const handleInitiate = async () => {
    if (initiateAttemptRef.current || !proposalValidation.isValid) {
      return;
    }

    initiateAttemptRef.current = true;
    setErrorMessage("");
    setInitiateErrorMessage("");
    setInitiateErrorCode(undefined);
    setIsInitiating(true);

    try {
      const telegramWriteAccess = await requestTelegramWriteAccess();

      if (telegramWriteAccess === "denied") {
        setInitiateErrorCode(TELEGRAM_BOT_ACCESS_ERROR_CODES.chatRequired);
        return;
      }

      await initiateMutation.mutateAsync();
    } catch {
      // The mutation owns and renders its API error state.
    } finally {
      initiateAttemptRef.current = false;
      setIsInitiating(false);
    }
  };

  const isInitiateActionPending =
    isInitiating || isRecoveryAccessPending || initiateMutation.isPending;
  const canSubmitProposal = canInitiate && proposalValidation.isValid;
  const handleOpenQuestions = () => {
    setIsOfferPopupOpen(false);
    if (dealIntent) {
      setDismissedDealIntentSlug(slug);
    }
    setFocusedContractSection("questions");
  };
  const contractPrimaryAction = showOfferAction ? (
    <div className="w-full rounded-4xl border border-white/20 bg-white/10 p-1 backdrop-filter backdrop-blur-[30px] backdrop-invert backdrop-hue-rotate-180 backdrop-brightness-[10%] backdrop-saturate-[100] dark:border-white/10 dark:bg-white/5">
      <Button
        onClick={handleOfferClick}
        variant="primary"
        shape="rounded-full"
        size="xl"
        fullWidth
        className="shadow-lg"
      >
        {offerTexts.submitLabel}
      </Button>
    </div>
  ) : undefined;
  const hasContractSidebarFooter = Boolean(
    contract &&
      ((meQuery.data?.id === contract.authorId && contract.category) ||
        (meQuery.data && isClaimable) ||
        canEdit ||
        hasStatusActions ||
        isModerator),
  );
  const contractSidebarFooter =
    contract && hasContractSidebarFooter ? (
      <>
        {meQuery.data?.id === contract.authorId && contract.category ? (
          <CategoryPromotionControl
            contractId={contract.id}
            categoryName={contract.category}
            isActive={contract.status === "active"}
          />
        ) : null}

        {meQuery.data && isClaimable ? (
          <ClaimContractWidget contract={contract} />
        ) : null}

        {canEdit || hasStatusActions ? (
          <ActionCard
            title={tDetails("Actions")}
            className="h-auto"
            bodyClassName="mt-5 flex flex-col gap-3"
            titleClassName={`${unbounded.className} font-extrabold tracking-[-0.035em]`}
          >
            {canEdit ? (
              <ActionCardLink href={routes.editContractBySlug(contract.slug)}>
                {tDetails("EditContract")}
              </ActionCardLink>
            ) : null}

            {hasStatusActions ? (
              <>
                <ResponsiveSelect
                  value={statusAction}
                  onChange={setStatusAction}
                  options={statusActionOptions}
                  placeholder={tDetails("SelectStatusAction")}
                  ariaLabel={tDetails("SelectStatusAction")}
                  disabled={statusMutationPending}
                />

                <ActionCardButton
                  type="button"
                  onClick={() => {
                    if (statusAction) {
                      setErrorMessage("");
                      setStatusActionToConfirm(statusAction);
                    }
                  }}
                  disabled={!statusAction || statusMutationPending}
                >
                  {publishMutation.isPending
                    ? tDetails("PublishingContract")
                    : archiveMutation.isPending
                      ? tDetails("ArchivingContract")
                      : restoreMutation.isPending
                        ? tDetails("RestoringContract")
                        : tDetails("ChangeStatus")}
                </ActionCardButton>
              </>
            ) : null}
          </ActionCard>
        ) : null}

        {isModerator ? (
          <ContractAiModerationInsights
            riskFactor={contract.aiRiskFactor}
            summary={contract.aiModerationSummary}
          />
        ) : null}
      </>
    ) : undefined;

  return (
    <>
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-6 pb-4">
        {contractQuery.isLoading ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
            <div className="flex min-w-0 flex-col gap-4">
              <SurfaceCard
                paddingClassName="p-0"
                className="overflow-hidden rounded-[2rem]"
              >
                <Skeleton className="h-[23rem] w-full rounded-none sm:h-[30rem]" />
              </SurfaceCard>
              <SurfaceCard className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
                <Skeleton className="mt-2 h-14 w-full rounded-[1.75rem]" />
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-16 w-full rounded-2xl" />
              </SurfaceCard>
            </div>

            <SurfaceCard className="h-fit xl:sticky xl:top-6">
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-7 w-20 rounded-full" />
                <Skeleton className="h-7 w-28 rounded-full" />
              </div>
              <Skeleton className="mt-4 h-9 w-4/5" />
              <div className="mt-6 grid grid-cols-2 overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/10">
                {Array.from({ length: 2 }, (_, index) => (
                  <div
                    key={index}
                    className={
                      index
                        ? "border-l border-zinc-200 p-5 dark:border-white/10"
                        : "p-5"
                    }
                  >
                    <Skeleton className="h-9 w-2/3" />
                    <Skeleton className="mt-2 h-3 w-4/5" />
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/10">
                {Array.from({ length: 4 }, (_, index) => (
                  <div
                    key={index}
                    className={`flex items-center gap-3 p-4 ${index % 2 ? "border-l border-zinc-200 dark:border-white/10" : ""} ${index > 1 ? "border-t border-zinc-200 dark:border-white/10" : ""}`}
                  >
                    <Skeleton className="h-5 w-5 rounded-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                ))}
              </div>
              <div className="mt-6 grid grid-cols-2 overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/10">
                {Array.from({ length: 4 }, (_, index) => (
                  <div
                    key={index}
                    className={`flex items-center gap-3 p-4 ${index % 2 ? "border-l border-zinc-200 dark:border-white/10" : ""} ${index > 1 ? "border-t border-zinc-200 dark:border-white/10" : ""}`}
                  >
                    <Skeleton className="h-5 w-5 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-2.5 w-14" />
                      <Skeleton className="h-3.5 w-20" />
                    </div>
                  </div>
                ))}
              </div>
              <Skeleton className="mt-3 h-14 w-full rounded-full" />
              <div className="mt-5 flex gap-4">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-14" />
              </div>
            </SurfaceCard>
          </div>
        ) : null}

        {contractQuery.isError ? (
          <SurfaceCard>
            <p className="text-sm text-red-700">
              {tDetails("ErrorOpenContract")}
            </p>
          </SurfaceCard>
        ) : null}

        {errorMessage && !isOfferDialogOpen ? (
          <SurfaceCard>
            <p className="text-sm text-red-700">{errorMessage}</p>
          </SurfaceCard>
        ) : null}

        {contract ? (
          <ContractDetails
            contract={contract}
            showStatus={showContractStatus}
            viewerId={meQuery.data?.id}
            viewerTelegramId={meQuery.data?.telegramId}
            botUsername={meQuery.isLoading ? undefined : botUsername}
            showFavoriteAction
            isViewerLoading={meQuery.isLoading}
            primaryAction={contractPrimaryAction}
            sidebarFooter={contractSidebarFooter}
            focusSection={focusedContractSection}
            onSectionFocused={() => setFocusedContractSection(null)}
            onFavoriteAuthRequired={() =>
              handleRequireAuth({
                label: contract.title,
                startApp: buildContractStartParam(contract.slug),
              })
            }
            onQuestionAuthRequired={() =>
              handleRequireAuth({
                label: tDetails("Questions"),
                startApp: buildContractStartParam(contract.slug),
              })
            }
          />
        ) : null}
      </main>

      {showOfferAction && !isOfferDialogOpen ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 p-4 xl:hidden">
          <div className="mx-auto flex w-full max-w-7xl justify-center xl:justify-end">
            <div className="pointer-events-auto w-full max-w-md rounded-4xl border border-white/20 bg-white/10 p-1 backdrop-filter backdrop-blur-[30px] backdrop-invert backdrop-hue-rotate-180 backdrop-brightness-[10%] backdrop-saturate-[100] dark:border-white/10 dark:bg-white/5">
              <Button
                onClick={handleOfferClick}
                variant="primary"
                shape="rounded-full"
                size="xl"
                fullWidth
                className="shadow-lg"
              >
                {offerTexts.submitLabel}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <ActionDialog
        isOpen={isOfferDialogOpen}
        onClose={() => {
          if (isInitiateActionPending) {
            return;
          }

          setIsOfferPopupOpen(false);
          if (dealIntent) {
            setDismissedDealIntentSlug(slug);
          }
        }}
        ariaLabel={offerTexts.title}
        actions={
          contract ? (
            <div className="flex w-full flex-col gap-2">
              <Button
                onClick={() => void handleInitiate()}
                disabled={!canSubmitProposal || isInitiateActionPending}
                loading={isInitiateActionPending}
                variant="primary"
                shape="rounded-2xl"
                size="lg"
                fullWidth
              >
                {offerTexts.submitLabel}
              </Button>

              {!contract.isRevealed && !isGuest ? (
                meQuery.data && meQuery.data.adBalance > 0 ? (
                  <Button
                    onClick={() => revealMutation.mutate()}
                    loading={revealMutation.isPending}
                    variant="secondary"
                    shape="rounded-2xl"
                    size="lg"
                    fullWidth
                  >
                    {tDetails("RevealContactsWithCredits", {
                      count: meQuery.data.adBalance,
                    })}
                  </Button>
                ) : (
                  <Button
                    onClick={handleRevealAd}
                    loading={adPending || revealMutation.isPending}
                    variant="secondary"
                    shape="rounded-2xl"
                    size="lg"
                    fullWidth
                  >
                    {adPending
                      ? tDetails("AdPending")
                      : tDetails("WatchAdAndReveal")}
                  </Button>
                )
              ) : null}

              {contract.isRevealed && contract.telegramPostUrl ? (
                <Button
                  href={contract.telegramPostUrl}
                  target="_blank"
                  rel="noreferrer"
                  variant="secondary"
                  shape="rounded-2xl"
                  size="lg"
                  fullWidth
                >
                  {tDetails("OpenOriginalPost")}
                </Button>
              ) : null}
            </div>
          ) : null
        }
      >
        {contract ? (
          <>
            <h2 className="text-lg font-semibold text-zinc-950">{offerTexts.title}</h2>
            <div className="mt-2 text-sm leading-7 text-zinc-600">{offerTexts.description}</div>

            {initiateErrorMessage || isTelegramBotChatRequiredError(initiateErrorCode) ? (
              <div
                className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200"
                role="alert"
              >
                {isTelegramBotChatRequiredError(initiateErrorCode) ? (
                  <TelegramBotAccessNotice
                    botUsername={botUsername}
                    onAccessGranted={handleInitiate}
                    onPendingChange={setIsRecoveryAccessPending}
                  />
                ) : (
                  initiateErrorMessage
                )}
              </div>
            ) : null}

            {errorMessage ? (
              <p
                className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200"
                role="alert"
              >
                {errorMessage}
              </p>
            ) : null}
            
            <div className="mt-6">
              {!contract.isRevealed && !isGuest ? (
                <div className="mb-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                  <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                    {tDetails("HiddenContactsDescription")}
                  </p>
                </div>
              ) : null}

              <DealProposalFields
                contract={contract}
                details={details}
                price={price}
                deadlineDays={deadlineDays}
                resources={briefResources}
                messagePlaceholder={offerTexts.messagePlaceholder}
                disabled={!canInitiate || isInitiateActionPending}
                isDetailsValid={proposalValidation.isDetailsValid}
                isPriceValid={proposalValidation.isPriceValid}
                isDeadlineValid={proposalValidation.isDeadlineValid}
                areResourcesValid={proposalValidation.areResourcesValid}
                onDetailsChange={setDetails}
                onPriceChange={setPriceDraft}
                onDeadlineDaysChange={setDeadlineDaysDraft}
                onResourcesChange={setBriefResources}
                onOpenQuestions={handleOpenQuestions}
              />

                  {!canInitiate ? (
                    <>
                      <p className="mt-3 text-sm text-zinc-500">
                        {isGuest
                          ? tDetails("GuestInitiateHint")
                          : isAuthor
                            ? tDetails("AuthorCannotInitiate")
                            : isClaimable
                              ? tDetails("UnclaimedCannotInitiate")
                              : tDetails("InactiveCannotInitiate")}
                      </p>
                      {isGuest ? (
                        <TelegramBotButton
                          botUsername={botUsername}
                          startApp={
                            dealIntent
                              ? buildContractDealIntentStartParam(contract.slug)
                              : buildContractStartParam(contract.slug)
                          }
                          label={tDetails("OpenViaTelegramBot")}
                          className="mt-3"
                        />
                      ) : null}
                    </>
                  ) : null}
            </div>
          </>
        ) : null}
      </ActionDialog>

      <ConfirmationDialog
        isOpen={statusConfirmation !== null}
        onClose={() => setStatusActionToConfirm(null)}
        onConfirm={() => {
          if (!contract || !statusActionToConfirm) {
            return;
          }

          if (statusActionToConfirm === "active") {
            publishMutation.mutate(contract.id);
            return;
          }

          if (statusActionToConfirm === "archived") {
            archiveMutation.mutate();
            return;
          }

          restoreMutation.mutate();
        }}
        description={statusConfirmation?.description ?? ""}
        confirmLabel={statusConfirmation?.confirmLabel}
        pendingLabel={statusConfirmation?.pendingLabel}
        isPending={statusMutationPending}
        errorMessage={statusActionToConfirm && errorMessage ? errorMessage : undefined}
      />

      <GuestLockDialog
        isOpen={isLocked}
        lockedItemLabel={lockedItemLabel}
        telegramContinueUrl={telegramContinueUrl}
        onClose={closeLock}
      />
    </>
  );
}
