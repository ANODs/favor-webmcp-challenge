"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

let openModalCount = 0;
let bodyOverflowBeforeFirstModal = "";
let restoreFocusTarget: HTMLElement | null = null;
let restoreFocusFrame: number | null = null;

const getFocusableElements = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      element.getAttribute("aria-hidden") !== "true" &&
      element.getClientRects().length > 0,
  );

const acquireBodyLock = (activeElement: Element | null) => {
  if (restoreFocusFrame !== null) {
    window.cancelAnimationFrame(restoreFocusFrame);
    restoreFocusFrame = null;
  }

  if (openModalCount === 0) {
    bodyOverflowBeforeFirstModal = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    if (!restoreFocusTarget?.isConnected) {
      restoreFocusTarget =
        activeElement instanceof HTMLElement ? activeElement : null;
    }
  }

  openModalCount += 1;
};

const releaseBodyLock = () => {
  openModalCount = Math.max(0, openModalCount - 1);
  if (openModalCount !== 0) return;

  document.body.style.overflow = bodyOverflowBeforeFirstModal;
  restoreFocusFrame = window.requestAnimationFrame(() => {
    restoreFocusFrame = null;
    if (openModalCount !== 0) return;

    if (restoreFocusTarget?.isConnected) {
      restoreFocusTarget.focus({ preventScroll: true });
    }
    restoreFocusTarget = null;
  });
};

export function useModalAccessibility({
  isOpen,
  onClose,
  dialogRef,
}: {
  isOpen: boolean;
  onClose: () => void;
  dialogRef: RefObject<HTMLElement | null>;
}) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    acquireBodyLock(document.activeElement);
    const dialog = dialogRef.current;
    const initialFocusFrame = window.requestAnimationFrame(() => {
      const target = dialog
        ? getFocusableElements(dialog)[0] ?? dialog
        : null;
      target?.focus({ preventScroll: true });
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !dialog) return;

      const focusableElements = getFocusableElements(dialog);
      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && (activeElement === firstElement || !dialog.contains(activeElement))) {
        event.preventDefault();
        lastElement.focus();
      } else if (
        !event.shiftKey &&
        (activeElement === lastElement || !dialog.contains(activeElement))
      ) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.cancelAnimationFrame(initialFocusFrame);
      document.removeEventListener("keydown", handleKeyDown, true);
      releaseBodyLock();
    };
  }, [dialogRef, isOpen]);
}
