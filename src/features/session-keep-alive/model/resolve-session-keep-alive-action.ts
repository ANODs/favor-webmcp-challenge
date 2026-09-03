import type { AuthSessionRefreshOutcome } from "@/shared/api";

export type SessionKeepAliveAction = {
  userCache: "clear" | "invalidate" | "none";
  refreshRoute: boolean;
};

export const resolveSessionKeepAliveAction = (
  outcome: AuthSessionRefreshOutcome,
): SessionKeepAliveAction => {
  if (outcome.status === "refreshed") {
    return {
      userCache: "invalidate",
      refreshRoute: outcome.recoveredAccess,
    };
  }

  if (outcome.status === "expired") {
    return {
      userCache: "clear",
      refreshRoute: false,
    };
  }

  return {
    userCache: "none",
    refreshRoute: false,
  };
};
