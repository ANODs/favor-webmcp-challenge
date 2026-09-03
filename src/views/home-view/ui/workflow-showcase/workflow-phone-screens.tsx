"use client";

import type { ComponentType, ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  AtSign,
  Check,
  ChevronRight,
  Copy,
  Eye,
  FileText,
  Link2,
  Paperclip,
  Send,
  Share2,
  Star,
  UsersRound,
} from "lucide-react";

import {
  getContractRichMessageCtaLabel,
  parseTagsInput,
} from "@/entities/contract";
import type { DealDto } from "@/entities/deal";
import { ReviewCard, type ReviewDto } from "@/entities/review";
import { ContractQuestionsPanelView } from "@/features/contract-questions";
import { CreateContractWizardPreview } from "@/features/create-contract";
import { DealReviewForm } from "@/features/review-deal";
import { SurfaceCard, TelegramShareMenuPanel } from "@/shared/ui";
import { DealStatusTimeline } from "@/widgets/deal-status-timeline";
import { PRODUCT_PHONE_SCREEN } from "@/widgets/product-phone-scene";

import {
  TELEGRAM_SCREEN_LAYOUT,
  TELEGRAM_SCREEN_THEME,
} from "../telegram-phone-chat-theme";
import {
  TelegramPhoneHeader,
  TelegramPhoneStatusBar,
} from "../telegram-phone-chrome";
import type {
  WorkflowPhoneStageId,
  WorkflowTypewriterSequenceId,
} from "./model/types";

export const WORKFLOW_PHONE_WIDTH = PRODUCT_PHONE_SCREEN.cssWidth;
export const WORKFLOW_PHONE_HEIGHT = PRODUCT_PHONE_SCREEN.cssHeight;
export const WORKFLOW_PHONE_SCREEN_IDS = [1, 2, 3, 4, 5] as const;

export type WorkflowPhoneScreenId = (typeof WORKFLOW_PHONE_SCREEN_IDS)[number];
export type WorkflowPhoneLocale = "ru" | "en";

export type WorkflowPhoneScreenProps = {
  screenId: WorkflowPhoneScreenId;
  stageId: WorkflowPhoneStageId;
  animateTransitions?: boolean;
  locale?: WorkflowPhoneLocale;
  statusTime: string;
  className?: string;
};

type InternalScreenProps = {
  stageId: WorkflowPhoneStageId;
  locale: WorkflowPhoneLocale;
  animateTransitions: boolean;
  copy: WorkflowPhoneCopy;
  statusTime: string;
};

export function WorkflowPhoneScreen({
  screenId,
  stageId,
  animateTransitions = true,
  locale = "ru",
  statusTime,
  className = "",
}: WorkflowPhoneScreenProps) {
  const Screen = workflowPhoneScreenRegistry[screenId];
  const copy = useWorkflowPhoneCopy();

  return (
    <div
      className={`shrink-0 ${className}`}
      data-screen-id={screenId}
      data-screen-stage={stageId}
      style={{
        height: WORKFLOW_PHONE_HEIGHT,
        width: WORKFLOW_PHONE_WIDTH,
      }}
    >
      <Screen
        stageId={stageId}
        locale={locale}
        animateTransitions={animateTransitions}
        copy={copy}
        statusTime={statusTime}
      />
    </div>
  );
}

function useWorkflowPhoneCopy() {
  const t = useTranslations("Index.Workflow.phone");

  return {
    common: {
      today: t("common.today"),
      contactAvatar: t("common.contactAvatar"),
      contactName: t("common.contactName"),
      online: t("common.online"),
      typing: t("common.typing"),
      messagePlaceholder: t("common.messagePlaceholder"),
      telegramChannelAria: t("common.telegramChannelAria"),
    },
    chat: {
      request: t("chat.request"),
      replyFromPost: t("chat.replyFromPost"),
      replyFavor: t("chat.replyFavor"),
    },
    post: {
      channelTitle: t("post.channelTitle"),
      subscribers: t("post.subscribers"),
      menuCopy: t("post.menuCopy"),
      menuShare: t("post.menuShare"),
      menuOpenBrowser: t("post.menuOpenBrowser"),
      copied: t("post.copied"),
      author: t("post.author"),
      title: t("post.title"),
      intro: t("post.intro"),
      process: t("post.process"),
      includedTitle: t("post.includedTitle"),
      included: [
        t("post.includedResponsive"),
        t("post.includedAnimations"),
        t("post.includedLaunch"),
      ],
      price: t("post.price"),
      portfolio: t("post.portfolio"),
      audience: t("post.audience"),
      terms: t("post.terms"),
      cta: t("post.cta"),
      comments: t("post.comments"),
      mediaProductTitle: t("post.mediaProductTitle"),
      mediaAnalytics: t("post.mediaAnalytics"),
      mediaProjects: t("post.mediaProjects"),
      mediaProjectItems: [
        t("post.mediaLanding"),
        t("post.mediaDashboard"),
        t("post.mediaMobile"),
        t("post.mediaAnalyticsItem"),
        t("post.mediaLaunch"),
      ],
    },
    share: {
      request: t("share.request"),
      inlineQuery: t("share.inlineQuery"),
      botTitle: t("share.botTitle"),
      contractTitle: t("share.contractTitle"),
      deadline: t("share.deadline"),
      offerLabel: t("share.offerLabel"),
      via: t("share.via"),
      description: t("share.description"),
      details: t("share.details"),
      typeLabel: t("share.typeLabel"),
      typeValue: t("share.typeValue"),
      budgetLabel: t("share.budgetLabel"),
      deadlineLabel: t("share.deadlineLabel"),
      settlementLabel: t("share.settlementLabel"),
      settlementValue: t("share.settlementValue"),
      published: t("share.published"),
    },
    questions: {
      contractTitle: t("questions.contractTitle"),
      question: t("questions.question"),
      answer: t("questions.answer"),
    },
    deal: {
      heading: t("deal.heading", { id: 1042 }),
    },
    review: {
      comment: t("review.comment"),
      reviewerName: t("review.reviewerName"),
      heading: t("review.heading", { id: 1042 }),
      publishedTitle: t("review.publishedTitle"),
    },
    wizard: {
      title: t("wizard.title"),
      description: t("wizard.description"),
      personalization: t("wizard.personalization"),
      tags: t("wizard.tags"),
    },
  };
}

type WorkflowPhoneCopy = ReturnType<typeof useWorkflowPhoneCopy>;

function TelegramWorkScreen({
  stageId,
  animateTransitions,
  copy,
  statusTime,
}: InternalScreenProps) {
  const showReply =
    stageId === "telegram-reply" ||
    stageId === "telegram-favor-typing" ||
    stageId === "telegram-favor-typing-pulse" ||
    stageId === "telegram-favor";
  const showReplyTyping = stageId === "telegram-reply-typing";
  const showReplyDraft = stageId === "telegram-reply-typing-pulse";
  const showFavorTyping = stageId === "telegram-favor-typing";
  const showFavorDraft = stageId === "telegram-favor-typing-pulse";
  const showFavor = stageId === "telegram-favor";
  const showReplyFollowUp = showFavor || showFavorTyping || showFavorDraft;

  return (
    <TelegramPrivateChat
      bodyClassName="px-4 pb-4 pt-3"
      copy={copy}
      statusTime={statusTime}
    >
      <TelegramDateSeparator label={copy.common.today} />

      <ChatBubble
        time="13:34"
        text={copy.chat.request}
      />

      <StageReveal
        visible={showReplyTyping}
        animateTransitions={animateTransitions}
        distance={10}
      >
        <TelegramTypingIndicator
          outgoing
          label={copy.common.typing}
          pulse={0}
        />
      </StageReveal>

      <StageReveal
        visible={showReplyDraft}
        animateTransitions={animateTransitions}
        distance={10}
      >
        <ChatBubble
          outgoing
          time="13:35"
          text={copy.chat.replyFromPost}
          typewriterId="chat-reply"
          textVisible={false}
        />
      </StageReveal>

      <StageReveal
        visible={showReply}
        animateTransitions={animateTransitions}
        distance={14}
        className={showReplyFollowUp ? "pb-3" : undefined}
      >
        <ChatBubble
          outgoing
          time="13:35"
          groupPosition={showReplyFollowUp ? "top" : "solo"}
          text={copy.chat.replyFromPost}
          typewriterId="chat-reply"
        />
      </StageReveal>

      <StageReveal
        visible={showFavorTyping}
        animateTransitions={animateTransitions}
        distance={10}
      >
        <TelegramTypingIndicator
          outgoing
          label={copy.common.typing}
          pulse={1}
        />
      </StageReveal>

      <StageReveal
        visible={showFavorDraft}
        animateTransitions={animateTransitions}
        distance={10}
      >
        <ChatBubble
          outgoing
          time="13:36"
          groupPosition="bottom"
          text={copy.chat.replyFavor}
          typewriterId="chat-favor"
          textVisible={false}
        />
      </StageReveal>

      <StageReveal
        visible={showFavor}
        animateTransitions={animateTransitions}
        distance={16}
        delay={0.05}
      >
        <ChatBubble
          outgoing
          time="13:36"
          groupPosition="bottom"
          text={copy.chat.replyFavor}
          typewriterId="chat-favor"
        />
      </StageReveal>
    </TelegramPrivateChat>
  );
}

function WorkPostScreen({
  stageId,
  animateTransitions,
  copy,
  locale,
  statusTime,
}: InternalScreenProps) {
  const showMenu = stageId === "post-share-menu";
  const showCopied = stageId === "post-link-copied";

  return (
    <TelegramSurface>
      <TelegramPhoneStatusBar time={statusTime} />
      <TelegramPhoneHeader
        avatar="F"
        title={copy.post.channelTitle}
        subtitle={copy.post.subscribers}
        contextLabel={copy.common.telegramChannelAria}
      />

      <div
        className="relative overflow-hidden bg-[#0f0f0f] p-1"
        style={{
          height:
            TELEGRAM_SCREEN_LAYOUT.height -
            TELEGRAM_SCREEN_LAYOUT.statusBarHeight -
            TELEGRAM_SCREEN_LAYOUT.headerHeight,
        }}
      >
        <TelegramChannelPost copy={copy} locale={locale} />

        <AnimatePresence initial={false} mode="wait">
          {showMenu ? (
            <motion.div
              key="post-menu"
              data-stage-overlay="post-menu"
              className="absolute right-5 top-14 z-10 w-[224px] origin-top-right overflow-hidden rounded-[18px] border border-white/10 bg-[#2b2c33] p-1.5 shadow-[0_24px_64px_rgba(0,0,0,0.55)]"
              initial={
                animateTransitions
                  ? { opacity: 0, scale: 0.94, y: -8 }
                  : false
              }
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -6 }}
              transition={stageTransition(animateTransitions, 0.22)}
            >
              <MenuRow
                icon={<Copy />}
                label={copy.post.menuCopy}
                active
              />
              <MenuRow icon={<Share2 />} label={copy.post.menuShare} />
              <MenuRow icon={<Link2 />} label={copy.post.menuOpenBrowser} />
            </motion.div>
          ) : showCopied ? (
            <motion.div
              key="post-copied"
              data-stage-overlay="post-copied"
              className="absolute inset-x-7 bottom-6 z-20 flex items-center justify-center gap-2 rounded-full bg-[#75f760] px-4 py-3 text-[12px] font-extrabold text-black shadow-[0_16px_38px_rgba(0,0,0,0.38)]"
              initial={
                animateTransitions
                  ? { opacity: 0, scale: 0.96, y: 16 }
                  : false
              }
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 8 }}
              transition={stageTransition(animateTransitions, 0.26)}
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              <span>{copy.post.copied}</span>
              <span className="font-semibold opacity-55">my_work/128</span>
            </motion.div>
          ) : null}
        </AnimatePresence>

      </div>
    </TelegramSurface>
  );
}

function ContractWizardScreen({
  stageId,
  animateTransitions,
  copy,
  statusTime,
}: InternalScreenProps) {
  const previewProgress = CONTRACT_PREVIEW_PROGRESS_BY_STAGE[stageId] ?? 1;

  return (
    <div className="relative h-full overflow-hidden bg-zinc-950 text-white">
      <TelegramPhoneStatusBar time={statusTime} />
      <div className="relative h-[672px] overflow-hidden">
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={stageId}
            data-wizard-stage={stageId}
            className="absolute inset-0"
            initial={
              animateTransitions
                ? { opacity: 0, y: 12, scale: 0.99 }
                : false
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              y: -8,
              scale: 0.995,
              transition: stageTransition(animateTransitions, 0.14),
            }}
            transition={stageTransition(animateTransitions, 0.24)}
          >
            <CreateContractWizardPreview
              copy={copy.wizard}
              progress={previewProgress}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function ContractShareScreen({
  stageId,
  animateTransitions,
  copy,
  locale,
  statusTime,
}: InternalScreenProps) {
  let content: ReactNode;

  if (stageId === "share-mini-app") {
    content = (
      <div className="h-full overflow-hidden bg-zinc-950 text-white">
        <TelegramPhoneStatusBar time={statusTime} />
        <div className="h-[672px]">
          <TelegramShareMenuPanel
            embedded
            activeOption="rich"
            isPreparing={false}
            isRichShareAvailable
            onClose={() => undefined}
            onCopyLink={() => undefined}
            onRichShare={() => undefined}
            onPlainShare={() => undefined}
          />
        </div>
      </div>
    );
  } else if (
    stageId === "share-inline-typing" ||
    stageId === "share-inline"
  ) {
    content = (
      <TelegramInlineShareStage
        copy={copy}
        locale={locale}
        queryVisible={stageId === "share-inline"}
        statusTime={statusTime}
      />
    );
  } else {
    content = (
      <SentContractShareStage
        copy={copy}
        locale={locale}
        statusTime={statusTime}
      />
    );
  }

  return (
    <StageDeck
      stageKey={stageId}
      animateTransitions={animateTransitions}
      distance={12}
    >
      {content}
    </StageDeck>
  );
}

function SentContractShareStage({
  copy,
  locale,
  statusTime,
}: {
  copy: WorkflowPhoneCopy;
  locale: WorkflowPhoneLocale;
  statusTime: string;
}) {
  return (
    <TelegramPrivateChat
      bodyClassName="px-3 pb-4 pt-2"
      copy={copy}
      statusTime={statusTime}
    >
      <TelegramDateSeparator label={copy.common.today} />
      <ChatBubble
        time="13:40"
        text={copy.share.request}
      />
      <TelegramInlineContractPost copy={copy} locale={locale} />
    </TelegramPrivateChat>
  );
}

function TelegramInlineShareStage({
  copy,
  locale,
  queryVisible,
  statusTime,
}: {
  copy: WorkflowPhoneCopy;
  locale: WorkflowPhoneLocale;
  queryVisible: boolean;
  statusTime: string;
}) {
  return (
    <TelegramPrivateChat
      copy={copy}
      statusTime={statusTime}
      composerContent={(
        <>
          <span
            className={queryVisible ? undefined : "invisible"}
            data-workflow-typewriter="share-inline-query"
          >
            <span className="font-bold text-[#9188ff]">@FavorDealsBot</span>
            {` ${copy.share.inlineQuery}`}
          </span>
        </>
      )}
    >
      <ChatBubble
        time="13:40"
        text={copy.share.request}
      />

      <div
        className="absolute inset-x-3 bottom-4 overflow-hidden rounded-[18px] border border-white/10 bg-[#202127] shadow-[0_22px_60px_rgba(0,0,0,0.52)]"
      >
          <div className="flex items-center gap-3 border-b border-white/[0.07] px-3.5 py-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-[18px] font-black text-black">
              F
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-extrabold text-white">
                {copy.share.botTitle}
              </p>
              <p className="mt-0.5 text-[8px] font-semibold text-[#9188ff]">
                @FavorDealsBot
              </p>
            </div>
            <AtSign className="h-4 w-4 text-white/30" aria-hidden="true" />
          </div>

          <div className="flex items-center gap-3 bg-[#3426c9] px-3.5 py-3">
            <div className="h-14 w-14 shrink-0 rounded-xl bg-[radial-gradient(circle_at_75%_20%,#ff4ca6,transparent_38%),linear-gradient(145deg,#171b85,#4338ca)]" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-extrabold text-white">
                {copy.share.contractTitle}
              </p>
              <p className="mt-1 text-[9px] leading-4 text-white/55">
                {formatWorkflowBudget(locale)} · {copy.share.deadline}
              </p>
              <p className="mt-0.5 text-[8px] font-semibold text-[#a9a2ff]">
                {copy.share.offerLabel}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-white/35" aria-hidden="true" />
          </div>
      </div>
    </TelegramPrivateChat>
  );
}

function LifecycleScreen({
  stageId,
  locale,
  animateTransitions,
  copy,
  statusTime,
}: InternalScreenProps) {
  const dealStatus = DEAL_STATUS_BY_STAGE[stageId];
  const content =
    dealStatus ? (
      <DealStatusStage copy={copy} status={dealStatus} />
    ) : stageId === "deal-review" ? (
      <DealReviewStage copy={copy} published={false} locale={locale} />
    ) : stageId === "deal-complete" ? (
      <DealReviewStage copy={copy} published locale={locale} />
    ) : (
      <ContractQuestionsStage copy={copy} />
    );

  return (
    <div className="h-full overflow-hidden bg-zinc-950 text-white">
      <TelegramPhoneStatusBar time={statusTime} />
      <StageDeck
        stageKey={stageId}
        animateTransitions={animateTransitions}
        className="h-[672px]"
        distance={10}
      >
        {content}
      </StageDeck>
    </div>
  );
}

export const workflowPhoneScreenRegistry = {
  1: TelegramWorkScreen,
  2: WorkPostScreen,
  3: ContractWizardScreen,
  4: ContractShareScreen,
  5: LifecycleScreen,
} satisfies Record<WorkflowPhoneScreenId, ComponentType<InternalScreenProps>>;

function ContractQuestionsStage({ copy }: { copy: WorkflowPhoneCopy }) {
  return (
    <div className="px-3 pb-4 pt-3">
      <SurfaceCard className="rounded-[1.5rem]" paddingClassName="p-3.5">
        <p className="mb-3 flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[0.13em] text-zinc-500">
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          {copy.questions.contractTitle}
        </p>
        <ContractQuestionsPanelView
          isAuthor
          isAuthenticated
          question=""
          questions={[
            {
              id: 1042,
              question: copy.questions.question,
              answer: copy.questions.answer,
              createdAt: "2026-08-25T13:44:00+03:00",
              publishedAt: "2026-08-25T13:46:00+03:00",
            },
          ]}
          compact
          onQuestionChange={() => undefined}
          onSubmit={(event) => event.preventDefault()}
        />
      </SurfaceCard>
    </div>
  );
}

const DEAL_STATUS_BY_STAGE: Partial<
  Record<WorkflowPhoneStageId, DealDto["status"]>
> = {
  "deal-status-pending": "pending_approval",
  "deal-status-progress": "in_progress",
  "deal-status-result": "result_sent_by_freelancer",
  "deal-status-payment": "paid_by_customer",
  "deal-status": "awaiting_review",
};

function DealStatusStage({
  copy,
  status,
}: {
  copy: WorkflowPhoneCopy;
  status: DealDto["status"];
}) {
  return (
    <div className="px-3 pb-4 pt-3">
      <p className="mb-2 flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[0.13em] text-zinc-500">
        <UsersRound className="h-3.5 w-3.5" aria-hidden="true" />
        {copy.deal.heading}
      </p>
      <div className="origin-top-left scale-[0.75] [width:133.333333%]">
        <DealStatusTimeline status={status} />
      </div>
    </div>
  );
}

function DealReviewStage({
  copy,
  published,
  locale,
}: {
  copy: WorkflowPhoneCopy;
  published: boolean;
  locale: WorkflowPhoneLocale;
}) {
  const comment = copy.review.comment;
  const review = {
    id: 1042,
    dealId: 1042,
    reviewerId: 12,
    reviewedUserId: 34,
    rating: 5,
    comment,
    createdAt: "2026-08-25T13:48:00+03:00",
    reviewer: {
      id: 12,
      name: copy.review.reviewerName,
      telegramUsername: "maria_product",
    },
  } satisfies ReviewDto;

  return (
    <div className="px-3 pb-4 pt-3">
      <p className="mb-2 flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[0.13em] text-zinc-500">
        <Star className="h-3.5 w-3.5" aria-hidden="true" />
        {copy.review.heading}
      </p>
      <div className="relative min-h-[560px]">
        {published ? (
          <ReviewCard
            review={review}
            title={copy.review.publishedTitle}
            className="!rounded-[1.5rem] !bg-zinc-900 !p-4 sm:!p-4"
            locale={locale === "ru" ? "ru-RU" : "en-US"}
            timeZone="Europe/Moscow"
          />
        ) : (
          <DealReviewForm
            reviewRating="5"
            reviewComment={comment}
            compact
            onRatingChange={() => undefined}
            onCommentChange={() => undefined}
            onSubmit={() => undefined}
          />
        )}
      </div>
    </div>
  );
}

function TelegramChannelPost({
  copy,
  locale,
}: {
  copy: WorkflowPhoneCopy;
  locale: WorkflowPhoneLocale;
}) {
  const reactions = [
    ["🔥", "12"],
    ["👍", "7"],
    ["⚡", "3"],
    ["💬", "2"],
  ] as const;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[15px] bg-[#191919]">
      <div className="px-3 pb-2 pt-2.5">
        <p className="truncate text-[10px] font-extrabold text-[#ff9d42]">
          {copy.post.author}
        </p>
      </div>

      <TelegramPostMedia copy={copy} />

      <div className="flex min-h-0 flex-1 flex-col px-3 pb-2.5 pt-2.5 text-white">
        <p className="text-[11px] font-extrabold leading-[1.35]">
          {copy.post.title}
        </p>
        <p className="mt-2 text-[9px] font-medium leading-[1.5] text-white/88">
          {copy.post.intro}
        </p>

        <p className="mt-2 text-[9px] font-medium leading-[1.5] text-white/88">
          🧩{" "}
          {copy.post.process}
        </p>

        <div className="mt-2.5 rounded-r-md border-l-2 border-[#ff9d42] bg-[#2b241d] px-2 py-1.5 text-[9px] font-extrabold text-white/92">
          {copy.post.includedTitle}
        </div>

        <div className="mt-1.5 space-y-1 text-[8.5px] font-medium leading-[1.35] text-white/88">
          {copy.post.included.map((item) => (
            <p key={item} className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#51d72f]" />
              {item}
            </p>
          ))}
        </div>

        <p className="mt-2.5 text-[8.5px] font-medium leading-[1.45] text-white/78">
          {copy.post.price}
        </p>

        <p className="mt-2 text-[8.5px] font-medium leading-[1.45] text-white/78">
          📎{" "}
          {copy.post.portfolio}
        </p>

        <p className="mt-2 text-[8.5px] font-medium leading-[1.45] text-white/78">
          {copy.post.audience}
        </p>

        <p className="mt-2 text-[8.5px] font-medium leading-[1.45] text-white/78">
          {copy.post.terms}
        </p>

        <div className="mt-2 rounded-r-md border-l-2 border-[#ff9d42] bg-[#2b241d] px-2 py-1.5 text-[8.5px] font-extrabold text-white/92">
          🔥{" "}
          {copy.post.cta}
        </div>

        <div className="mt-auto flex items-center gap-1.5 pt-2.5">
          {reactions.map(([emoji, count]) => (
            <span
              key={emoji}
              className="rounded-full bg-[#2a2a2a] px-2 py-1 text-[8px] font-bold text-white/85"
            >
              {emoji} {count}
            </span>
          ))}
          <span className="ml-auto flex items-center gap-1 text-[8px] font-semibold text-white/28">
            <Eye className="h-3 w-3" aria-hidden="true" />
            {formatWorkflowViews(locale)}
          </span>
          <span className="text-[8px] font-semibold text-white/28">13:31</span>
        </div>
      </div>

      <div className="flex h-10 items-center border-t border-white/[0.06] px-3">
        <div className="flex -space-x-1.5" aria-hidden="true">
          <span className="grid h-5 w-5 place-items-center rounded-full border border-[#191919] bg-[#d6a276] text-[8px]">
            👩
          </span>
          <span className="grid h-5 w-5 place-items-center rounded-full border border-[#191919] bg-[#7f8bd6] text-[8px]">
            👨
          </span>
          <span className="grid h-5 w-5 place-items-center rounded-full border border-[#191919] bg-[#51d72f] text-[8px]">
            💬
          </span>
        </div>
        <span className="ml-2 text-[9px] font-bold text-white/90">
          {copy.post.comments}
        </span>
        <ChevronRight className="ml-auto h-4 w-4 text-white/65" aria-hidden="true" />
      </div>
    </article>
  );
}

function TelegramPostMedia({
  copy,
  compact = false,
}: {
  copy: WorkflowPhoneCopy;
  compact?: boolean;
}) {
  return (
    <div
      className={`grid shrink-0 grid-cols-[1.55fr_0.95fr] gap-[2px] bg-[#08090c] p-[2px] ${compact ? "h-[104px]" : "h-[142px]"}`}
    >
      <div className="grid grid-rows-2 gap-[2px]">
        <div className="relative overflow-hidden bg-[#0b1020] px-2.5 pb-2 pt-5">
          <div className="absolute inset-x-0 top-0 flex h-4 items-center gap-1 border-b border-white/[0.06] bg-[#151824] px-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ff695f]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#ffc14e]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#4bd865]" />
            <span className="ml-1 h-1.5 flex-1 rounded-full bg-white/[0.06]" />
          </div>

          <span className="text-[5px] font-black uppercase tracking-[0.14em] text-[#75f760]">
            SaaS / Next.js
          </span>
          <p className="mt-0.5 max-w-[116px] text-[10px] font-black leading-[0.98] tracking-[-0.04em] text-white">
            {copy.post.mediaProductTitle}
          </p>
          <div className="absolute bottom-2 right-2 h-5 w-[46px] rounded-md bg-[linear-gradient(145deg,#3528d8,#8b5cf6_55%,#ff61a7)]" />
        </div>

        <div className="relative overflow-hidden bg-[#11141c] p-2">
          <div className="flex h-full items-end gap-1">
            {[26, 38, 23, 46, 33, 52, 42, 58, 48].map((height, index) => (
              <span
                key={`${height}-${index}`}
                className="flex-1 rounded-t-sm bg-[linear-gradient(180deg,#75f760,#2e8f46)]"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
          <span className="absolute left-2 top-2 text-[5px] font-bold text-white/70">
            {copy.post.mediaAnalytics}
          </span>
        </div>
      </div>

      <div className="relative overflow-hidden bg-[#171a22] p-2">
        <div className="flex items-center justify-between border-b border-white/[0.05] pb-1.5">
          <span className="text-[6px] font-black text-white">NOVA</span>
          <span className="h-1.5 w-5 rounded-full bg-[#7c6cff]" />
        </div>
        <p className="mt-2 text-[5px] font-bold uppercase tracking-[0.12em] text-white/35">
          {copy.post.mediaProjects}
        </p>
        <div className="mt-1.5 space-y-1.5">
          {copy.post.mediaProjectItems.map((label, index) => (
            <div
              key={label}
              className="flex items-center gap-1.5 rounded-[4px] bg-white/[0.04] p-1"
            >
              <span
                className={`h-4 w-4 rounded-[3px] ${
                  index % 2 === 0 ? "bg-[#4638d6]" : "bg-[#2a2d38]"
                }`}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[5px] font-bold text-white/75">
                  {label}
                </span>
                <span className="mt-0.5 block h-1 w-full rounded-full bg-white/[0.06]" />
              </span>
            </div>
          ))}
        </div>
        <div className="absolute inset-x-2 bottom-2 flex gap-1">
          <span className="h-2 flex-1 rounded-full bg-[#75f760]" />
          <span className="h-2 w-6 rounded-full bg-white/[0.06]" />
        </div>
      </div>
    </div>
  );
}

function TelegramInlineContractPost({
  copy,
  locale,
}: {
  copy: WorkflowPhoneCopy;
  locale: WorkflowPhoneLocale;
}) {
  return (
    <div>
      <article className="overflow-hidden rounded-[14px] rounded-br-[5px] border border-white/[0.06] bg-[#343436] shadow-[0_18px_46px_rgba(0,0,0,0.3)]">
        <div className="px-3 pb-2 pt-2.5">
          <p className="text-[7px] font-semibold text-white/50">
            {copy.share.via} {" "}
            <span className="font-extrabold text-[#9b94ff]">@FavorDealsBot</span>
          </p>
          <p className="mt-1 text-[13px] font-extrabold leading-tight text-white">
            {copy.share.contractTitle}
          </p>
        </div>

        <TelegramPostMedia copy={copy} compact />

        <div className="px-3 pb-2.5 pt-2 text-[8px] leading-[1.42] text-white/82">
          <p className="font-semibold text-white/45">Favor Deals</p>
          <p className="mt-1.5 border-l-2 border-[#9b94ff] pl-2.5">
            {copy.share.description}
          </p>

          <p className="mt-2 text-[9px] font-extrabold text-white">
            {copy.share.details}
          </p>
          <div className="mt-1 overflow-hidden rounded-[7px] border border-white/15">
            {[
              [copy.share.typeLabel, copy.share.typeValue],
              [copy.share.budgetLabel, formatWorkflowBudget(locale)],
              [copy.share.deadlineLabel, copy.share.deadline],
              [copy.share.settlementLabel, copy.share.settlementValue],
            ].map(([label, value], index) => (
              <div
                key={label}
                className={`grid grid-cols-[82px_1fr] ${index > 0 ? "border-t border-white/12" : ""}`}
              >
                <span className="border-r border-white/12 bg-black/8 px-2 py-1 text-white/55">
                  {label}
                </span>
                <strong className="px-2 py-1 font-semibold text-white">{value}</strong>
              </div>
            ))}
          </div>

          <p className="mt-1.5 text-[#a7a1ff]">
            {formatWorkflowTags(copy.wizard.tags)}
          </p>
          <div className="mt-1 flex items-end justify-between gap-2 text-[7px] text-white/36">
            <span>{copy.share.published}</span>
            <span className="shrink-0">13:42 ✓✓</span>
          </div>
        </div>
      </article>

      <div className="mt-1.5 rounded-[11px] border border-white/[0.05] bg-[#17181d] px-4 py-2.5 text-center text-[10px] font-extrabold text-[#a59fff] shadow-[0_12px_30px_rgba(0,0,0,0.22)]">
        {getContractRichMessageCtaLabel(locale).toUpperCase()}
      </div>
    </div>
  );
}

function TelegramPrivateChat({
  children,
  bodyClassName = "px-3 pb-4 pt-4",
  copy,
  composerContent,
  statusTime,
}: {
  children: ReactNode;
  bodyClassName?: string;
  copy: WorkflowPhoneCopy;
  composerContent?: ReactNode;
  statusTime: string;
}) {
  return (
    <TelegramSurface>
      <TelegramPhoneStatusBar time={statusTime} />
      <TelegramPhoneHeader
        avatar={copy.common.contactAvatar}
        title={copy.common.contactName}
        subtitle={copy.common.online}
      />
      <div
        className={`relative overflow-hidden ${bodyClassName}`}
        style={{ height: TELEGRAM_SCREEN_LAYOUT.chatBodyHeight }}
      >
        {children}
      </div>
      <TelegramComposer placeholder={copy.common.messagePlaceholder}>
        {composerContent}
      </TelegramComposer>
    </TelegramSurface>
  );
}

function TelegramSurface({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative h-full overflow-hidden text-white"
      style={{
        backgroundColor: TELEGRAM_SCREEN_THEME.surface,
        backgroundImage:
          "radial-gradient(circle,rgba(255,255,255,0.045) 0.7px,transparent 0.8px)",
        backgroundPosition: "8px 12px",
        backgroundSize: "16px 16px",
      }}
    >
      {children}
    </div>
  );
}

function TelegramDateSeparator({ label }: { label: string }) {
  return (
    <div className="mb-3 flex justify-center">
      <span className="rounded-full bg-black/35 px-3 py-1.5 text-[8px] font-semibold text-white/38">
        {label}
      </span>
    </div>
  );
}

function ChatBubble({
  text: value,
  time,
  outgoing = false,
  groupPosition = "solo",
  typewriterId,
  textVisible = true,
}: {
  text: string;
  time: string;
  outgoing?: boolean;
  groupPosition?: "solo" | "top" | "bottom";
  typewriterId?: WorkflowTypewriterSequenceId;
  textVisible?: boolean;
}) {
  const groupedCorner = outgoing
    ? groupPosition === "top"
      ? "rounded-br-[7px]"
      : groupPosition === "bottom"
        ? "rounded-br-[5px] rounded-tr-[7px]"
        : "rounded-br-[5px]"
    : "rounded-bl-[5px]";
  const spacing = groupPosition === "top" ? "mb-0" : "mb-3";

  return (
    <div
      className={`${spacing} relative max-w-[278px] rounded-[17px] px-3.5 py-3 text-[13px] font-medium leading-[1.4] ${groupedCorner} ${
        outgoing
          ? "ml-auto text-white"
          : "text-[#f4f4f5]"
      }`}
      style={{
        background: outgoing
          ? `linear-gradient(135deg,${TELEGRAM_SCREEN_THEME.outgoingStart},${TELEGRAM_SCREEN_THEME.outgoingEnd})`
          : TELEGRAM_SCREEN_THEME.incoming,
      }}
    >
      <span>
        <span
          className={textVisible ? undefined : "invisible"}
          data-workflow-typewriter={typewriterId}
        >
          {value}
        </span>
        <span className="inline-block w-14" aria-hidden="true" />
      </span>
      <span
        className={`absolute bottom-2.5 right-3 text-[8px] font-semibold leading-none ${outgoing ? "text-white/55" : "text-white/30"}`}
      >
        {time} {outgoing ? "✓✓" : ""}
      </span>
    </div>
  );
}

function TelegramTypingIndicator({
  label,
  outgoing = false,
  pulse = 0,
}: {
  label: string;
  outgoing?: boolean;
  pulse?: 0 | 1;
}) {
  return (
    <div
      className={`mb-3 flex h-[38px] w-[68px] items-center justify-center gap-2 rounded-full ${
        outgoing ? "ml-auto" : ""
      }`}
      style={{
        background: outgoing
          ? `linear-gradient(135deg,${TELEGRAM_SCREEN_THEME.outgoingStart},${TELEGRAM_SCREEN_THEME.outgoingEnd})`
          : TELEGRAM_SCREEN_THEME.incoming,
      }}
      role="status"
      aria-label={label}
    >
      {(pulse === 0 ? [1, 0.56, 0.32] : [0.32, 0.56, 1]).map(
        (opacity, index) => (
          <span
            key={index}
            className="h-1.5 w-1.5 rounded-full bg-white"
            style={{
              opacity,
              transform: `translateY(${index === 1 ? -1 : 1}px)`,
            }}
            aria-hidden="true"
          />
        ),
      )}
    </div>
  );
}

const CONTRACT_PREVIEW_PROGRESS_BY_STAGE: Partial<
  Record<WorkflowPhoneStageId, number>
> = {
  "contract-source-typing": 0,
  "contract-source-loading": 0.14,
  "contract-source": 0.3,
  "contract-content-typing": 0.34,
  "contract-content": 0.48,
  "contract-terms-typing": 0.66,
  "contract-terms-deadline": 0.74,
  "contract-terms": 1,
};

function formatWorkflowBudget(locale: WorkflowPhoneLocale) {
  return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(1_200);
}

function formatWorkflowViews(locale: WorkflowPhoneLocale) {
  return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(1_200);
}

function formatWorkflowTags(value: string) {
  return parseTagsInput(value)
    .map((tag) => `#${tag.replaceAll(/\s+/g, "_")}`)
    .join("  ");
}

function TelegramComposer({
  children,
  placeholder,
}: {
  children?: ReactNode;
  placeholder: string;
}) {
  return (
    <div
      className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-2 border-t border-white/10 px-3"
      style={{
        backgroundColor: TELEGRAM_SCREEN_THEME.header,
        height: TELEGRAM_SCREEN_LAYOUT.composerHeight,
      }}
    >
      <Paperclip className="h-5 w-5 text-white/35" aria-hidden="true" />
      <div
        className={`min-w-0 flex-1 truncate rounded-full px-4 py-2.5 text-[11px] ${children ? "text-white/75" : "text-white/35"}`}
        style={{ backgroundColor: TELEGRAM_SCREEN_THEME.composerInput }}
      >
        {children ?? placeholder}
      </div>
      <span
        className="grid h-10 w-10 place-items-center rounded-full text-white"
        style={{ backgroundColor: TELEGRAM_SCREEN_THEME.composerSend }}
      >
        <Send className="h-4 w-4" aria-hidden="true" />
      </span>
    </div>
  );
}

function MenuRow({
  icon,
  label,
  active = false,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-[14px] px-3 py-3 text-[11px] font-semibold ${
        active ? "bg-[#75f760] text-black" : "text-white/86"
      }`}
    >
      <span className="h-4 w-4 shrink-0 [&>svg]:h-full [&>svg]:w-full">{icon}</span>
      {label}
    </div>
  );
}

const STAGE_EASE = [0.22, 1, 0.36, 1] as const;

function stageTransition(
  animateTransitions: boolean,
  duration: number,
  delay = 0,
) {
  return animateTransitions
    ? { delay, duration, ease: STAGE_EASE }
    : { delay: 0, duration: 0 };
}

function StageReveal({
  visible,
  animateTransitions,
  children,
  className,
  distance = 16,
  delay = 0,
}: {
  visible: boolean;
  animateTransitions: boolean;
  children: ReactNode;
  className?: string;
  distance?: number;
  delay?: number;
}) {
  return (
    <AnimatePresence initial={false}>
      {visible ? (
        <motion.div
          key="visible"
          className={className}
          initial={
            animateTransitions
              ? { opacity: 0, y: distance, scale: 0.985 }
              : false
          }
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: Math.min(8, distance / 2), scale: 0.99 }}
          transition={stageTransition(animateTransitions, 0.28, delay)}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function StageDeck({
  stageKey,
  animateTransitions,
  children,
  className = "h-full",
  distance = 12,
}: {
  stageKey: WorkflowPhoneStageId;
  animateTransitions: boolean;
  children: ReactNode;
  className?: string;
  distance?: number;
}) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={stageKey}
          data-stage-deck={stageKey}
          className="absolute inset-0"
          initial={
            animateTransitions
              ? { opacity: 0, y: distance, scale: 0.99 }
              : false
          }
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{
            opacity: 0,
            y: -Math.min(8, distance),
            scale: 0.995,
            transition: stageTransition(animateTransitions, 0.14),
          }}
          transition={stageTransition(animateTransitions, 0.24)}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
