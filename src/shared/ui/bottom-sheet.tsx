"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRef, type ReactNode } from "react";

import { useDialogBackButton } from "./telegram-back-button";
import { useModalAccessibility } from "./use-modal-accessibility";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  ariaLabel: string;
  closeLabel: string;
  children: ReactNode;
  rootClassName?: string;
  contentClassName?: string;
  overlayClassName?: string;
};

export function BottomSheet({
  isOpen,
  onClose,
  onBack,
  ariaLabel,
  children,
  rootClassName = "z-50",
  contentClassName = "",
  overlayClassName = "",
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogBackButton(isOpen, onBack ?? onClose);
  useModalAccessibility({ isOpen, onClose, dialogRef });

  return (
    <AnimatePresence>
      {isOpen ? (
        <div className={`fixed inset-0 flex items-end justify-center sm:p-4 ${rootClassName}`}>
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className={`absolute inset-0 cursor-default bg-black/70 backdrop-blur-[2px] ${overlayClassName}`}
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            tabIndex={-1}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className={`relative z-10 max-h-[92dvh] w-full overflow-y-auto overscroll-contain rounded-t-[2rem] border border-b-0 border-[var(--border-soft)] bg-[var(--surface)] shadow-2xl sm:mb-2 sm:max-w-xl sm:rounded-[2rem] sm:border-b ${contentClassName}`}
          >
            <div className="sticky top-0 z-20 flex h-6 items-center justify-center bg-inherit pt-2 sm:rounded-t-[2rem]">
              <div className="h-1 w-12 rounded-full bg-[var(--border-soft)]" />
            </div>
            {children}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
