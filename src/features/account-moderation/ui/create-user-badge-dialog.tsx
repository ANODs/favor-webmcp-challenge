"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";

import type { CreateUserBadgePayload } from "@/entities/user";
import { Dialog } from "@/shared/ui";

import { UserBadgeForm } from "./user-badge-form";

type Props = {
  isOpen: boolean;
  isPending: boolean;
  errorMessage?: string;
  onClose: () => void;
  onSubmit: (payload: CreateUserBadgePayload) => Promise<void>;
};

export function CreateUserBadgeDialog({
  isOpen,
  isPending,
  errorMessage,
  onClose,
  onSubmit,
}: Props) {
  const t = useTranslations("AccountRestrictions");

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel={t("createBadgeDialogAriaLabel")}
      contentClassName="rounded-[2rem] bg-white p-5 shadow-2xl dark:bg-zinc-950 sm:p-6"
      closeOnOverlayClick={!isPending}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-zinc-950 dark:text-white">
            {t("createBadgeTitle")}
          </h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {t("createBadgeDescription")}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          aria-label={t("closeBadgeDialog")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 dark:hover:bg-white/10"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <UserBadgeForm
        submitLabel={t("createBadge")}
        isPending={isPending}
        errorMessage={errorMessage}
        onSubmit={onSubmit}
        onCancel={onClose}
        onCompleted={onClose}
      />
    </Dialog>
  );
}
