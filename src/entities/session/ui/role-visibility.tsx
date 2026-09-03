"use client";

import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import type { CurrentSessionUserDto } from "@/shared/types/session-user";

import { authClient } from "../api/auth-client";
import { sessionQueryKeys } from "../api/query-keys";

type Props = {
  children: ReactNode;
  roles?: CurrentSessionUserDto["role"][];
  when?: (user: CurrentSessionUserDto) => boolean;
  fallback?: ReactNode;
};

export function RoleVisibility({ children, roles, when, fallback = null }: Props) {
  const meQuery = useQuery({
    queryKey: sessionQueryKeys.currentUser,
    queryFn: authClient.getMe,
  });

  if (meQuery.isLoading) {
    return null;
  }

  if (!meQuery.data) {
    return <>{fallback}</>;
  }

  if (roles?.length && !roles.includes(meQuery.data.role)) {
    return <>{fallback}</>;
  }

  if (when && !when(meQuery.data)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

