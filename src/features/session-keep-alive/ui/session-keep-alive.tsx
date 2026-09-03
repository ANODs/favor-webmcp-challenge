"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { authClient, sessionQueryKeys } from "@/entities/session";

import { resolveSessionKeepAliveAction } from "../model/resolve-session-keep-alive-action";

const SESSION_KEEP_ALIVE_INTERVAL_MS = 6 * 60 * 60 * 1000;
const SESSION_REFRESH_EVENT_THROTTLE_MS = 60 * 60 * 1000;

export function SessionKeepAlive() {
  const queryClient = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    let disposed = false;
    let lastAttemptAt = 0;

    const refreshSession = (force = false) => {
      if (document.visibilityState === "hidden" || !navigator.onLine) {
        return;
      }

      const now = Date.now();
      if (!force && now - lastAttemptAt < SESSION_REFRESH_EVENT_THROTTLE_MS) {
        return;
      }
      lastAttemptAt = now;

      void authClient
        .refreshSession()
        .then((outcome) => {
          if (disposed) return;

          const action = resolveSessionKeepAliveAction(outcome);

          if (action.userCache === "invalidate") {
            void queryClient.invalidateQueries({
              queryKey: sessionQueryKeys.currentUser,
            });
          } else if (action.userCache === "clear") {
            queryClient.setQueryData(sessionQueryKeys.currentUser, null);
          }

          if (action.refreshRoute) {
            router.refresh();
          }
        })
        .catch(() => undefined);
    };

    const handleVisibilityChange = () => refreshSession();
    const handleFocus = () => refreshSession();
    const handleOnline = () => refreshSession(true);

    refreshSession(true);
    const intervalId = window.setInterval(
      () => refreshSession(true),
      SESSION_KEEP_ALIVE_INTERVAL_MS,
    );
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleOnline);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleOnline);
    };
  }, [queryClient, router]);

  return null;
}
