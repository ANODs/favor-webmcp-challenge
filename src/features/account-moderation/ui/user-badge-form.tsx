"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import {
  USER_BADGE_ICON_KEYS,
  USER_BADGE_TONES,
  type CreateUserBadgePayload,
  type UserBadgeDto,
  type UserBadgeIconKey,
  type UserBadgeTone,
} from "@/entities/user";
import { UserBadgeIcon, UserBadgePill } from "@/entities/user/ui";
import { Button } from "@/shared/ui";

type Props = {
  submitLabel: string;
  isPending: boolean;
  errorMessage?: string;
  onSubmit: (payload: CreateUserBadgePayload) => Promise<void>;
  onCancel?: () => void;
  onCompleted?: () => void;
};

const emptyForm: CreateUserBadgePayload = {
  labelRu: "",
  labelEn: "",
  descriptionRu: "",
  descriptionEn: "",
  iconKey: "sparkles",
  tone: "brand-accent",
};

const iconLabelKeys = {
  sparkles: "badgeIconSparkles",
  award: "badgeIconAward",
  shield: "badgeIconShield",
  star: "badgeIconStar",
  heart: "badgeIconHeart",
  zap: "badgeIconZap",
  rocket: "badgeIconRocket",
  crown: "badgeIconCrown",
} as const satisfies Record<UserBadgeIconKey, string>;

const toneLabelKeys = {
  "brand-accent": "badgeToneAccent",
  "brand-blue": "badgeToneBlue",
  "brand-pink": "badgeTonePink",
  default: "badgeToneNeutral",
} as const satisfies Record<UserBadgeTone, string>;

const fieldClassName =
  "w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-900 dark:border-white/15 dark:bg-white/5 dark:text-white dark:focus:border-white/40";

export function UserBadgeForm({
  submitLabel,
  isPending,
  errorMessage,
  onSubmit,
  onCancel,
  onCompleted,
}: Props) {
  const t = useTranslations("AccountRestrictions");
  const [form, setForm] = useState<CreateUserBadgePayload>(emptyForm);

  const previewBadge: UserBadgeDto = {
    id: -1,
    code: "preview",
    labelRu: form.labelRu.trim() || t("badgePreviewLabel"),
    labelEn: form.labelEn.trim() || t("badgePreviewLabel"),
    descriptionRu:
      form.descriptionRu.trim() || t("badgePreviewDescription"),
    descriptionEn:
      form.descriptionEn.trim() || t("badgePreviewDescription"),
    iconKey: form.iconKey,
    tone: form.tone,
    sortOrder: 100,
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    try {
      await onSubmit(form);
      setForm(emptyForm);
      onCompleted?.();
    } catch {
      // The parent mutation renders the server error in this form.
    }
  };

  const updateField = <TKey extends keyof CreateUserBadgePayload>(
    key: TKey,
    value: CreateUserBadgePayload[TKey],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      <div className="rounded-3xl border border-dashed border-zinc-200 bg-zinc-50 p-4 dark:border-white/15 dark:bg-white/5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {t("badgePreview")}
        </p>
        <UserBadgePill badge={previewBadge} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
          {t("badgeLabelRu")}
          <input
            required
            minLength={1}
            maxLength={48}
            value={form.labelRu}
            onChange={(event) => updateField("labelRu", event.target.value)}
            className={fieldClassName}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
          {t("badgeLabelEn")}
          <input
            required
            minLength={1}
            maxLength={48}
            value={form.labelEn}
            onChange={(event) => updateField("labelEn", event.target.value)}
            className={fieldClassName}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
          {t("badgeDescriptionRu")}
          <textarea
            required
            minLength={3}
            maxLength={240}
            rows={3}
            value={form.descriptionRu}
            onChange={(event) =>
              updateField("descriptionRu", event.target.value)
            }
            className={fieldClassName}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
          {t("badgeDescriptionEn")}
          <textarea
            required
            minLength={3}
            maxLength={240}
            rows={3}
            value={form.descriptionEn}
            onChange={(event) =>
              updateField("descriptionEn", event.target.value)
            }
            className={fieldClassName}
          />
        </label>
      </div>

      <fieldset className="grid gap-3">
        <legend className="text-sm font-semibold text-zinc-900 dark:text-white">
          {t("badgeIconLabel")}
        </legend>
        <div
          role="radiogroup"
          aria-label={t("badgeIconLabel")}
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
          {USER_BADGE_ICON_KEYS.map((iconKey) => {
            const isSelected = form.iconKey === iconKey;

            return (
              <button
                key={iconKey}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => updateField("iconKey", iconKey)}
                className={`flex min-h-11 items-center gap-2 rounded-2xl border px-3 py-2 text-left text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  isSelected
                    ? "border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-zinc-950"
                    : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-white/15 dark:text-zinc-200 dark:hover:bg-white/5"
                }`}
              >
                <UserBadgeIcon iconKey={iconKey} className="h-4 w-4" />
                <span>{t(iconLabelKeys[iconKey])}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="text-sm font-semibold text-zinc-900 dark:text-white">
          {t("badgeToneLabel")}
        </legend>
        <div
          role="radiogroup"
          aria-label={t("badgeToneLabel")}
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
          {USER_BADGE_TONES.map((tone) => {
            const isSelected = form.tone === tone;

            return (
              <button
                key={tone}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => updateField("tone", tone)}
                className={`min-h-11 rounded-2xl border px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  isSelected
                    ? "border-zinc-950 ring-1 ring-zinc-950 dark:border-white dark:ring-white"
                    : "border-zinc-200 hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/5"
                }`}
              >
                {t(toneLabelKeys[tone])}
              </button>
            );
          })}
        </div>
      </fieldset>

      {errorMessage ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {errorMessage}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button
            type="button"
            variant="secondary"
            disabled={isPending}
            onClick={onCancel}
          >
            {t("cancel")}
          </Button>
        ) : null}
        <Button type="submit" loading={isPending} disabled={isPending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
