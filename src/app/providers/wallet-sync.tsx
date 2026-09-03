"use client";

import { useEffect, useRef } from "react";
import { useTonAddress } from "@tonconnect/ui-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authClient, sessionQueryKeys } from "@/entities/session";

export function WalletSync() {
  const tonAddress = useTonAddress();
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: sessionQueryKeys.currentUser,
    queryFn: authClient.getMe,
    staleTime: Infinity,
  });

  const syncMutation = useMutation({
    mutationFn: (walletAddress: string | null) =>
      authClient.updateSettings({ walletAddress }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
    },
  });

  const user = meQuery.data;
  const lastSyncedAddressRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!user) return;

    // Use lowercase comparison to avoid minor mismatch issues, or normalize addresses.
    // TON addresses can be raw hex or bounceable/non-bounceable, but useTonAddress() returns standard user-friendly address.
    const currentWalletAddress = tonAddress || null;
    const dbWalletAddress = user.walletAddress || null;

    if (
      currentWalletAddress !== dbWalletAddress &&
      currentWalletAddress !== lastSyncedAddressRef.current
    ) {
      lastSyncedAddressRef.current = currentWalletAddress ?? "";
      syncMutation.mutate(currentWalletAddress);
    }
  }, [user, tonAddress, syncMutation]);

  return null;
}
