"use client";

import { useQuery } from "@tanstack/react-query";

import { subscriptionClient } from "../api/subscription-client";
import { favorSubscriptionQueryKeys } from "./query-keys";

export const useFavorSubscriptionOffer = (enabled = true) =>
  useQuery({
    queryKey: favorSubscriptionQueryKeys.offer,
    queryFn: subscriptionClient.getOffer,
    enabled,
    staleTime: 10_000,
    refetchInterval: enabled ? 10_000 : false,
  });
