"use client";

import type { AccountRestrictionScope } from "@prisma/client";
import { useTranslations } from "next-intl";
import { useState } from "react";

import {
  accountRestrictionReasonCodes,
  type AccountRestrictionReasonCode,
  type CreateAccountRestrictionPayload,
  type ModeratedUserDto,
} from "@/entities/user";
import { Button, Dialog, ResponsiveSelect, SurfaceCard } from "@/shared/ui";

const scopeValues: AccountRestrictionScope[] = [
  "all_writes",
  "contract_publish",
  "deal_create",
  "communication",
  "support",
  "login_lock",
];

const durationOptions = [
  { value: "1", messageKey: "duration.oneHour" },
  { value: "24", messageKey: "duration.oneDay" },
  { value: "168", messageKey: "duration.sevenDays" },
  { value: "720", messageKey: "duration.thirtyDays" },
  { value: "permanent", messageKey: "duration.permanent" },
] as const;

type Props = {
  user: ModeratedUserDto | null;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateAccountRestrictionPayload) => Promise<void>;
};

export function RestrictionDialog({ user, isPending, onClose, onSubmit }: Props) {
  const t = useTranslations("AccountRestrictions");
  const [scope, setScope] = useState<AccountRestrictionScope>("all_writes");
  const [duration, setDuration] = useState<(typeof durationOptions)[number]["value"]>("24");
  const [reasonCode, setReasonCode] =
    useState<AccountRestrictionReasonCode>("spam");
  const [publicMessage, setPublicMessage] = useState(() =>
    t("defaultPublicMessage"),
  );
  const [internalComment, setInternalComment] = useState("");
  const [validationMessage, setValidationMessage] = useState("");

  return (
    <Dialog
      isOpen={Boolean(user)}
      onClose={onClose}
      ariaLabel={t("dialogAriaLabel")}
    >
      <SurfaceCard className="p-5 sm:p-6">
        <div>
          <h2 className="text-xl font-semibold text-zinc-950 dark:text-white">
            {t("dialogTitle")}
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {user?.name ||
              user?.telegramUsername ||
              t("userFallback", { id: user?.id ?? "" })}
          </p>
        </div>

        <div className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {t("scopeLabel")}
            <ResponsiveSelect
              value={scope}
              options={scopeValues.map((value) => ({
                value,
                label: t(`scope.${value}`),
              }))}
              onChange={setScope}
              ariaLabel={t("scopeAriaLabel")}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {t("durationLabel")}
            <ResponsiveSelect
              value={duration}
              options={durationOptions.map(({ value, messageKey }) => ({
                value,
                label: t(messageKey),
              }))}
              onChange={setDuration}
              ariaLabel={t("durationAriaLabel")}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {t("reasonLabel")}
            <ResponsiveSelect
              value={reasonCode}
              options={accountRestrictionReasonCodes.map((value) => ({
                value,
                label: t(`reason.${value}`),
              }))}
              onChange={setReasonCode}
              ariaLabel={t("reasonAriaLabel")}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {t("publicMessageLabel")}
            <textarea
              value={publicMessage}
              onChange={(event) => setPublicMessage(event.target.value)}
              rows={3}
              maxLength={500}
              className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-normal text-zinc-950 outline-none transition focus:border-zinc-900 dark:border-white/15 dark:bg-white/5 dark:text-white"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {t("internalCommentLabel")}
            <textarea
              value={internalComment}
              onChange={(event) => setInternalComment(event.target.value)}
              rows={3}
              maxLength={2000}
              placeholder={t("internalCommentPlaceholder")}
              className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-normal text-zinc-950 outline-none transition focus:border-zinc-900 dark:border-white/15 dark:bg-white/5 dark:text-white"
            />
          </label>
        </div>

        {validationMessage ? (
          <p className="mt-4 text-sm text-red-700 dark:text-red-300">{validationMessage}</p>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            {t("cancel")}
          </Button>
          <Button
            type="button"
            disabled={isPending}
            onClick={async () => {
              if (publicMessage.trim().length < 3) {
                setValidationMessage(t("publicMessageRequired"));
                return;
              }

              setValidationMessage("");
              try {
                await onSubmit({
                  scope,
                  reasonCode,
                  publicMessage: publicMessage.trim(),
                  internalComment: internalComment.trim() || null,
                  expiresInHours: duration === "permanent" ? null : Number(duration),
                });
              } catch {
                // The parent mutation renders the server error above the panel.
              }
            }}
          >
            {isPending ? t("applying") : t("applyRestriction")}
          </Button>
        </div>
      </SurfaceCard>
    </Dialog>
  );
}
