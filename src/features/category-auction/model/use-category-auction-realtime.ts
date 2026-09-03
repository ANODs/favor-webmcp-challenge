"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { normalizeCategoryKey } from "@/entities/category";
import { categoryAuctionQueryKeys } from "./query-keys";
import {
  isCategoryAuctionRealtimeEvent,
  isCategoryAuctionRealtimeStatus,
} from "./realtime";

const reconnectDelay = (attempt: number) => Math.min(1_000 * 2 ** attempt, 15_000);

export function useCategoryAuctionRealtime(categoryName: string) {
  const queryClient = useQueryClient();
  const categoryKey = useMemo(() => normalizeCategoryKey(categoryName), [categoryName]);
  const [connectedCategoryKey, setConnectedCategoryKey] = useState<string | null>(null);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let refreshTimer: number | null = null;
    let reconnectAttempt = 0;
    let stopped = false;

    const refresh = () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: categoryAuctionQueryKeys.state(categoryName) }),
          queryClient.invalidateQueries({ queryKey: ["categories"] }),
        ]);
      }, 50);
    };

    const connect = () => {
      if (stopped) return;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = new URL(`${protocol}//${window.location.host}/ws/category-auctions`);
      url.searchParams.set("categoryKey", categoryKey);
      const currentSocket = new WebSocket(url);
      socket = currentSocket;

      currentSocket.addEventListener("open", () => {
        if (socket !== currentSocket) return;
        reconnectAttempt = 0;
        refresh();
      });
      currentSocket.addEventListener("message", (message) => {
        if (typeof message.data !== "string") return;
        try {
          const event: unknown = JSON.parse(message.data);
          if (isCategoryAuctionRealtimeStatus(event)) {
            setConnectedCategoryKey((current) => {
              if (event.available) return categoryKey;
              return current === categoryKey ? null : current;
            });
            if (event.available) refresh();
            return;
          }
          if (isCategoryAuctionRealtimeEvent(event) && event.categoryKey === categoryKey) {
            refresh();
          }
        } catch {
          // Ignore non-auction protocol messages.
        }
      });
      currentSocket.addEventListener("error", () => currentSocket.close());
      currentSocket.addEventListener("close", () => {
        if (socket !== currentSocket || stopped) return;
        setConnectedCategoryKey((current) => current === categoryKey ? null : current);
        reconnectTimer = window.setTimeout(connect, reconnectDelay(reconnectAttempt));
        reconnectAttempt += 1;
      });
    };

    connect();

    return () => {
      stopped = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      socket?.close(1000, "Category changed");
    };
  }, [categoryKey, categoryName, queryClient]);

  return connectedCategoryKey === categoryKey;
}
