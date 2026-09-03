"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

type ContextualHintProps = {
  isOpen: boolean;
  onDismiss: () => void;
  title: string;
  description?: string;
  dismissLabel: string;
  children: ReactNode;
};

export function ContextualHint({
  isOpen,
  onDismiss,
  title,
  description,
  dismissLabel,
  children,
}: ContextualHintProps) {
  return (
    <span className="relative inline-flex">
      {children}
      {isOpen ? (
        <span
          role="status"
          aria-live="polite"
          className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-64 max-w-[calc(100vw-2rem)] rounded-2xl bg-zinc-950 p-4 pr-10 text-left text-white shadow-[0_18px_48px_rgba(9,9,11,0.3)] dark:bg-white dark:text-zinc-950"
        >
          <span
            aria-hidden="true"
            className="absolute -top-1.5 right-4 h-3 w-3 rotate-45 bg-zinc-950 dark:bg-white"
          />
          <span className="block text-sm font-bold leading-5">{title}</span>
          {description ? (
            <span className="mt-1 block text-xs leading-5 text-zinc-300 dark:text-zinc-600">
              {description}
            </span>
          ) : null}
          <button
            type="button"
            aria-label={dismissLabel}
            title={dismissLabel}
            onClick={onDismiss}
            className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#75F760] dark:text-zinc-500 dark:hover:bg-black/5 dark:hover:text-zinc-950"
          >
            <X className="h-4 w-4" />
          </button>
        </span>
      ) : null}
    </span>
  );
}
