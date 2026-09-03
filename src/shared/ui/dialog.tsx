"use client";

import { useRef, type HTMLAttributes, type ReactNode } from "react";

import { useDialogBackButton } from "./telegram-back-button";
import { useModalAccessibility } from "./use-modal-accessibility";

type DialogProps = {
  isOpen: boolean;
  onClose: () => void;
  ariaLabel: string;
  children: ReactNode;
  contentClassName?: string;
  overlayClassName?: string;
  closeOnOverlayClick?: boolean;
} & HTMLAttributes<HTMLDivElement>;

export function Dialog({
  isOpen,
  onClose,
  ariaLabel,
  children,
  className = "",
  contentClassName = "",
  overlayClassName = "",
  closeOnOverlayClick = true,
  ...props
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogBackButton(isOpen, onClose);
  useModalAccessibility({ isOpen, onClose, dialogRef });

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-3 sm:p-4 ${overlayClassName}`}
      onClick={closeOnOverlayClick ? onClose : undefined}
    >
      <div
        {...props}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        className={`max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto ${className} ${contentClassName}`}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
