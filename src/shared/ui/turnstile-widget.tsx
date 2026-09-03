"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      appearance: "interaction-only";
      theme: "auto";
      callback: (token: string) => void;
      "error-callback": () => void;
      "expired-callback": () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
};

type Props = {
  action: string;
  onToken: (token: string) => void;
  onError: () => void;
};

const getTurnstile = () =>
  (window as typeof window & { turnstile?: TurnstileApi }).turnstile;

export function TurnstileWidget({ action, onToken, onError }: Props) {
  const t = useTranslations("Auth");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const onErrorRef = useRef(onError);
  const [scriptReady, setScriptReady] = useState(Boolean(typeof window !== "undefined" && getTurnstile()));
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

  useEffect(() => {
    onTokenRef.current = onToken;
    onErrorRef.current = onError;
  }, [onError, onToken]);

  const renderWidget = useCallback(() => {
    const turnstile = getTurnstile();
    if (!turnstile || !containerRef.current || widgetIdRef.current || !siteKey) {
      return;
    }

    widgetIdRef.current = turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action,
      appearance: "interaction-only",
      theme: "auto",
      callback: (token) => onTokenRef.current(token),
      "error-callback": () => onErrorRef.current(),
      "expired-callback": () => onErrorRef.current(),
    });
  }, [action, siteKey]);

  useEffect(() => {
    if (scriptReady) {
      renderWidget();
    }

    return () => {
      const turnstile = getTurnstile();
      if (turnstile && widgetIdRef.current) {
        turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [renderWidget, scriptReady]);

  if (!siteKey) {
    return (
      <p className="text-sm text-red-700 dark:text-red-300">
        {t("turnstileNotConfigured")}
      </p>
    );
  }

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onError={onError}
      />
      <div ref={containerRef} className="min-h-16 w-full" />
    </>
  );
}
