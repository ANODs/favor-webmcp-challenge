"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { ActionDialog } from "./action-dialog";
import { Button, type ButtonProps } from "./button";

type ConfirmationDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  description: ReactNode;
  title?: string;
  ariaLabel?: string;
  confirmLabel?: string;
  pendingLabel?: string;
  cancelLabel?: string;
  showCancelButton?: boolean;
  confirmVariant?: ButtonProps["variant"];
  isPending?: boolean;
  errorMessage?: string;
  errorContent?: ReactNode;
};

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  description,
  title,
  ariaLabel,
  confirmLabel,
  pendingLabel,
  cancelLabel,
  showCancelButton = true,
  confirmVariant = "primary",
  isPending = false,
  errorMessage,
  errorContent,
}: ConfirmationDialogProps) {
  const t = useTranslations("ConfirmationDialog");
  const resolvedTitle = title ?? t("Title");

  const handleClose = () => {
    if (!isPending) {
      onClose();
    }
  };

  return (
    <ActionDialog
      isOpen={isOpen}
      onClose={handleClose}
      ariaLabel={ariaLabel ?? resolvedTitle}
      actions={
        <>
          {showCancelButton ? (
            <Button
              type="button"
              onClick={handleClose}
              disabled={isPending}
              variant="secondary"
              shape="rounded-2xl"
              size="lg"
              fullWidth
            >
              {cancelLabel ?? t("Cancel")}
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={() => void onConfirm()}
            loading={isPending}
            variant={confirmVariant}
            shape="rounded-2xl"
            size="lg"
            fullWidth
          >
            {isPending ? (pendingLabel ?? t("Confirming")) : (confirmLabel ?? t("Confirm"))}
          </Button>
        </>
      }
    >
      <h2 className="text-lg font-semibold text-zinc-950">{resolvedTitle}</h2>
      <div className="mt-2 text-sm leading-6 text-zinc-600">{description}</div>
      {errorContent || errorMessage ? (
        <div
          className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200"
          role="alert"
        >
          {errorContent ?? errorMessage}
        </div>
      ) : null}
    </ActionDialog>
  );
}
