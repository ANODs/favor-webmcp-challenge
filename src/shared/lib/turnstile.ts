import { env } from "@/shared/config/env";

import { ApplicationError } from "./application-error";
import { getRequestIp } from "./request-ip";

type TurnstileResponse = {
  success: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
};

const TURNSTILE_ERROR_DEFINITIONS = {
  CHALLENGE_REQUIRED: {
    message: "Human verification is required.",
    status: 428,
  },
  CHALLENGE_FAILED: {
    message: "Human verification failed. Try again.",
    status: 403,
  },
  CHALLENGE_UNAVAILABLE: {
    message: "Human verification is temporarily unavailable. Try again later.",
    status: 503,
  },
} as const;

export type TurnstileErrorCode = keyof typeof TURNSTILE_ERROR_DEFINITIONS;

export const createTurnstileError = (
  code: TurnstileErrorCode,
  expectedAction: string,
) => {
  const definition = TURNSTILE_ERROR_DEFINITIONS[code];
  return new ApplicationError(
    code,
    definition.message,
    definition.status,
    { action: expectedAction },
  );
};

const getExpectedHostname = () => {
  try {
    return new URL(env.baseUrl).hostname;
  } catch {
    return null;
  }
};

export async function requireTurnstile(request: Request, expectedAction: string) {
  if (!env.isTurnstileConfigured) {
    return;
  }

  const token = request.headers.get("x-turnstile-token")?.trim();
  if (!token || token.length > 2048) {
    throw createTurnstileError("CHALLENGE_REQUIRED", expectedAction);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: env.turnstileSecretKey,
          response: token,
          remoteip: getRequestIp(request),
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new Error(`Siteverify returned ${response.status}`);
    }

    const result = (await response.json()) as TurnstileResponse;
    const expectedHostname = getExpectedHostname();
    if (
      !result.success ||
      result.action !== expectedAction ||
      (expectedHostname && result.hostname !== expectedHostname)
    ) {
      throw createTurnstileError("CHALLENGE_FAILED", expectedAction);
    }
  } catch (error) {
    if (error instanceof ApplicationError) {
      throw error;
    }

    throw createTurnstileError("CHALLENGE_UNAVAILABLE", expectedAction);
  } finally {
    clearTimeout(timeout);
  }
}
