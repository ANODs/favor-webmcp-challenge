"use client";

import { MessageCircleQuestion, Send } from "lucide-react";
import { useTranslations } from "next-intl";

import type { ContractQuestionDto } from "@/entities/contract-question";
import { Button } from "@/shared/ui";

type Props = {
  isAuthor: boolean;
  isAuthenticated: boolean;
  isViewerLoading?: boolean;
  questions: ContractQuestionDto[];
  question: string;
  successMessage?: string;
  errorMessage?: string;
  isPending?: boolean;
  compact?: boolean;
  onQuestionChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export function ContractQuestionsPanelView({
  isAuthor,
  isAuthenticated,
  isViewerLoading = false,
  questions,
  question,
  successMessage = "",
  errorMessage,
  isPending = false,
  compact = false,
  onQuestionChange,
  onSubmit,
}: Props) {
  const t = useTranslations("ContractQuestions");

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            className={`${compact ? "text-[15px]" : "text-lg"} font-extrabold text-zinc-950`}
          >
            {t("Title")}
          </h2>
          <p
            className={`${compact ? "mt-0.5 text-[10px] leading-4" : "mt-1 text-sm leading-6"} text-zinc-500`}
          >
            {t("Description")}
          </p>
        </div>
        <span className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-600 dark:bg-white/8">
          {t("PublishedCount", { count: questions.length })}
        </span>
      </div>

      {!isAuthor ? (
        <form
          onSubmit={onSubmit}
          className={`${compact ? "mt-3" : "mt-5"} rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-white/12`}
        >
          <label htmlFor="contract-question" className="sr-only">
            {t("InputLabel")}
          </label>
          <textarea
            id="contract-question"
            value={question}
            onChange={(event) => onQuestionChange(event.target.value)}
            rows={4}
            maxLength={1000}
            placeholder={t("Placeholder")}
            disabled={isPending || isViewerLoading}
            className="w-full resize-y bg-transparent px-1 py-1 text-sm leading-6 text-zinc-900 outline-none placeholder:text-zinc-400 disabled:cursor-not-allowed"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-3 dark:border-white/10">
            <span className="text-xs text-zinc-500">{t("PrivateHint")}</span>
            <Button
              type="submit"
              size="sm"
              shape="rounded-full"
              loading={isPending}
              disabled={isViewerLoading || (isAuthenticated && question.trim().length < 5)}
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              {isAuthenticated ? t("Send") : t("SignInToAsk")}
            </Button>
          </div>
          {successMessage ? (
            <p className="mt-3 text-sm font-medium text-emerald-700">{successMessage}</p>
          ) : null}
          {errorMessage ? (
            <p className="mt-3 text-sm font-medium text-red-700">{errorMessage}</p>
          ) : null}
        </form>
      ) : (
        <p
          className={`${compact ? "mt-3 p-3 text-[10px] leading-4" : "mt-5 p-4 text-sm"} rounded-2xl border border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-white/12`}
        >
          {t("AuthorHint")}
        </p>
      )}

      {questions.length ? (
        <div className={`${compact ? "mt-3 gap-2" : "mt-6 gap-3"} grid`}>
          {questions.map((item) => (
            <article
              key={item.id}
              className={`rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-white/12 ${compact ? "p-3" : "p-4 sm:p-5"}`}
            >
              <div className="flex gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950">
                  <MessageCircleQuestion className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p
                    className={`${compact ? "text-[11px] leading-4" : "text-sm leading-6"} font-bold text-zinc-950`}
                  >
                    {item.question}
                  </p>
                  <div className="mt-3 border-l-2 border-emerald-400 pl-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                      {t("AuthorAnswer")}
                    </p>
                    <p
                      className={`${compact ? "mt-1 text-[10px] leading-4" : "mt-1 text-sm leading-6"} whitespace-pre-wrap text-zinc-700`}
                    >
                      {item.answer}
                    </p>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-6 rounded-2xl border border-dashed border-zinc-300 p-5 text-center text-sm text-zinc-500 dark:border-white/15">
          {t("Empty")}
        </p>
      )}
    </div>
  );
}
