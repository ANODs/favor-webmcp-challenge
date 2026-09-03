"use client";

import {
  Check,
  Circle,
  Image as ImageIcon,
  Link2,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useTranslations } from "next-intl";

import {
  type ContractFormState,
  type TelegramPostPreviewDto,
} from "@/entities/contract";
import {
  ContractImagesPreview,
  TelegramPostButtonControl,
} from "@/entities/contract/ui";
import { Button } from "@/shared/ui";

import {
  wizardChoiceClassName,
  wizardFieldClassName,
  wizardHelperClassName,
} from "./wizard-styles";

type Props = {
  form: ContractFormState;
  preview: TelegramPostPreviewDto | null;
  botUsername: string;
  addTelegramPostButton: boolean;
  isSkipped: boolean;
  isPending: boolean;
  selectedImagesCount: number;
  updateFormField: <T extends keyof ContractFormState>(
    field: T,
    value: ContractFormState[T],
  ) => void;
  onUrlChange: (value: string) => void;
  onFetchPreview: () => void;
  onSkip: () => void;
  toggleImage: (imageUrl: string) => void;
  setPrimaryImage: (imageUrl: string) => void;
  setAddTelegramPostButton: (enabled: boolean) => void;
  compact?: boolean;
  showPostButtonControl?: boolean;
  hideUrlPlaceholder?: boolean;
};

export function ContractSourceStep({
  form,
  preview,
  botUsername,
  addTelegramPostButton,
  isSkipped,
  isPending,
  selectedImagesCount,
  updateFormField,
  onUrlChange,
  onFetchPreview,
  onSkip,
  toggleImage,
  setPrimaryImage,
  setAddTelegramPostButton,
  compact = false,
  showPostButtonControl = true,
  hideUrlPlaceholder = false,
}: Props) {
  const t = useTranslations("CreateContract");

  return (
    <div>
      <div className={`flex items-start border-b border-zinc-200 dark:border-white/10 ${compact ? "gap-3 pb-3.5" : "gap-4 pb-6"}`}>
        <div className={`flex shrink-0 items-center justify-center rounded-2xl border border-brand-accent-ink/20 bg-brand-accent/10 text-brand-accent-ink dark:border-brand-accent/20 dark:text-brand-accent ${compact ? "h-9 w-9" : "h-12 w-12"}`}>
          <ImageIcon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className={`${compact ? "text-[13px]" : "text-base sm:text-lg"} font-semibold text-zinc-950`}>
            {t("WizardImagesSourceTitle")}
          </h2>
          <p className={`${compact ? "mt-0.5 text-[10px] leading-4" : "mt-1 text-sm leading-6"} text-zinc-600`}>
            {t("WizardImagesSourceDescription")}
          </p>
        </div>
      </div>

      <fieldset className={compact ? "mt-3" : "mt-5"}>
        <legend className="sr-only">{t("WizardPostOwnershipLegend")}</legend>
        <div className={`grid ${compact ? "gap-2" : "gap-3 md:grid-cols-2"}`}>
          <button
            type="button"
            className={wizardChoiceClassName(!form.isScouting)}
            aria-pressed={!form.isScouting}
            onClick={() => updateFormField("isScouting", false)}
          >
            {!form.isScouting ? (
              <Check className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            ) : (
              <Circle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            )}
            <span>
              <span className="flex items-center gap-2 text-sm font-semibold sm:text-[15px]">
                <UserRound className="h-4 w-4" aria-hidden="true" />
                {t("WizardOwnPost")}
              </span>
              <span
                className="mt-1 block text-xs leading-5 text-zinc-500"
              >
                {t("WizardOwnPostDescription")}
              </span>
            </span>
          </button>

          <button
            type="button"
            className={wizardChoiceClassName(form.isScouting)}
            aria-pressed={form.isScouting}
            onClick={() => updateFormField("isScouting", true)}
          >
            {form.isScouting ? (
              <Check className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            ) : (
              <Circle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            )}
            <span>
              <span className="flex items-center gap-2 text-sm font-semibold sm:text-[15px]">
                <UsersRound className="h-4 w-4" aria-hidden="true" />
                {t("WizardScoutPost")}
              </span>
              <span
                className="mt-1 block text-xs leading-5 text-zinc-500"
              >
                {t("WizardScoutPostDescription")}
              </span>
            </span>
          </button>
        </div>
      </fieldset>

      <div className={`${compact ? "mt-3 gap-2.5" : "mt-6 gap-4"} grid`}>
        <label className="grid gap-2 text-sm font-semibold text-zinc-900">
          {t("WizardTelegramPostLabel")}
          <div className={`grid ${compact ? "gap-2" : "gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"}`}>
            <div className="relative">
              <Link2
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                aria-hidden="true"
              />
              <input
                name="telegramPostUrl"
                value={form.telegramPostUrl}
                onChange={(event) => onUrlChange(event.target.value)}
                placeholder={
                  hideUrlPlaceholder ? "" : "https://t.me/channel_name/123"
                }
                inputMode="url"
                autoCapitalize="none"
                className={`${wizardFieldClassName} pl-11`}
              />
            </div>
            <Button
              type="button"
              variant="accent"
              shape="rounded-2xl"
              size="lg"
              onClick={onFetchPreview}
              loading={isPending}
              disabled={isPending || form.telegramPostUrl.trim().length === 0}
              className={compact ? "w-full" : "sm:min-w-52"}
            >
              {isPending ? t("Loading") : t("FetchFromPost")}
            </Button>
          </div>
          <span className={wizardHelperClassName}>
            {t("WizardTelegramPostHelper")}
          </span>
        </label>

        {form.isScouting ? (
          <label className="grid gap-2 text-sm font-semibold text-zinc-900">
            {t("WizardScoutUsernameLabel")}
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-zinc-400">
                @
              </span>
              <input
                value={form.scoutedTelegramUsername.replace(/^@/, "")}
                onChange={(event) =>
                  updateFormField(
                    "scoutedTelegramUsername",
                    event.target.value.trim(),
                  )
                }
                placeholder="username"
                autoCapitalize="none"
                className={`${wizardFieldClassName} pl-9`}
              />
            </div>
            <span className={wizardHelperClassName}>
              {t("WizardScoutUsernameHelper")}
            </span>
          </label>
        ) : null}
      </div>

      {showPostButtonControl && preview && !form.isScouting ? (
        <TelegramPostButtonControl
          variant="create"
          botUsername={botUsername}
          enabled={addTelegramPostButton}
          onEnabledChange={setAddTelegramPostButton}
          className="mt-6"
          compact={compact}
        />
      ) : null}

      {preview ? (
        <ContractImagesPreview
          preview={preview}
          tone="accent"
          selectedMediaRefs={form.mediaRefs}
          toggleImage={toggleImage}
          setPrimaryImage={setPrimaryImage}
          selectedImagesCount={selectedImagesCount}
          description={t("ImagesPreviewDesc")}
        />
      ) : null}

      <div className={`${compact ? "mt-3 gap-2 pt-3" : "mt-6 gap-3 pt-5 sm:flex-row sm:items-center"} flex flex-col border-t border-zinc-200 dark:border-white/10`}>
        <Button
          type="button"
          variant="secondary"
          shape="rounded-2xl"
          size="lg"
          onClick={onSkip}
          disabled={isPending}
          className={`shrink-0 ${
            isSkipped
              ? "border-brand-accent-ink/40 bg-brand-accent/10 text-brand-accent-ink hover:bg-brand-accent/15 dark:border-brand-accent/40 dark:text-brand-accent"
              : ""
          }`}
        >
          {isSkipped ? t("WizardSkippedSource") : t("WizardSkipSource")}
        </Button>
        <p className="text-xs leading-5 text-zinc-500">
          {isSkipped
            ? t("WizardSkippedSourceDescription")
            : t("WizardSkipSourceDescription")}
        </p>
      </div>
    </div>
  );
}
