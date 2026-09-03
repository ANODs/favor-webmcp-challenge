"use client";

import type { ReactNode } from "react";
import { Dialog } from "./dialog";

type ActionDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  ariaLabel: string;
  children: ReactNode;
  actions: ReactNode;
  contentClassName?: string;
};

export function ActionDialog({
  isOpen,
  onClose,
  ariaLabel,
  children,
  actions,
  contentClassName = "",
}: ActionDialogProps) {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel={ariaLabel}
      contentClassName={`relative flex flex-col rounded-[2rem] bg-[var(--surface)] !p-0 ${contentClassName}`}
      className="!overflow-visible"
    >
      <div className="flex-1 overflow-y-auto rounded-t-[2rem] p-5 sm:p-6">
        {children}
      </div>
      <div className="shrink-0 rounded-b-[2rem] border-t border-[var(--border-soft)] bg-[var(--surface-muted)] p-4 sm:p-5">
        <div className="mx-auto flex w-full flex-col gap-3 sm:flex-row">
          {actions}
        </div>
      </div>
    </Dialog>
  );
}
