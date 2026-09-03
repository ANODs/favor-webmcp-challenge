export const AUTH_SESSION_CLIENT_LOCK_NAME = "favor-auth-session";

export const withAuthSessionClientLock = async <T>(
  operation: () => Promise<T>,
): Promise<T> => {
  if (typeof navigator === "undefined" || !("locks" in navigator)) {
    return operation();
  }

  return navigator.locks.request(AUTH_SESSION_CLIENT_LOCK_NAME, () =>
    operation(),
  );
};
