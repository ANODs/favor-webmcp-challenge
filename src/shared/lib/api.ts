import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

import { ApplicationError } from "./application-error";
import { isDatabaseUnavailableError } from "./prisma-errors";

const serializeForJson = (value: unknown): unknown => {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Prisma.Decimal) {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map(serializeForJson);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, serializeForJson(nestedValue)]),
    );
  }

  return value;
};

export const ok = <T>(data: T, init?: ResponseInit) =>
  NextResponse.json(
    {
      ok: true,
      data: serializeForJson(data),
    },
    init,
  );

export const fail = (
  message: string,
  status = 400,
  details?: unknown,
  headers?: HeadersInit,
) =>
  NextResponse.json(
    {
      ok: false,
      error: message,
      details: serializeForJson(details),
    },
    { status, headers },
  );

const failWithCode = (
  code: string,
  message: string,
  status: number,
  details?: Record<string, unknown>,
  headers?: HeadersInit,
) => fail(message, status, { code, ...details }, headers);

const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/;

export const handleRouteError = (error: unknown) => {
  if (error instanceof ZodError) {
    return fail("Request validation failed.", 400, error.issues);
  }

  if (error instanceof Error) {
    if (isDatabaseUnavailableError(error)) {
      return failWithCode(
        "SERVICE_UNAVAILABLE",
        "The service is temporarily unavailable.",
        503,
      );
    }

    if (error instanceof ApplicationError) {
      return fail(
        error.message,
        error.status,
        {
          code: error.code,
          ...(error.details && typeof error.details === "object"
            ? error.details
            : { context: error.details }),
        },
        error.headers,
      );
    }

    if (error.message === "UNAUTHORIZED") {
      return failWithCode(
        "AUTH_SESSION_REQUIRED",
        "Authentication required.",
        401,
      );
    }

    if (error.message === "NOT_FOUND") {
      return failWithCode("NOT_FOUND", "Resource not found.", 404);
    }

    if (error.message === "FORBIDDEN") {
      return failWithCode(
        "FORBIDDEN",
        "You do not have permission to perform this action.",
        403,
      );
    }

    if (ERROR_CODE_PATTERN.test(error.message)) {
      return failWithCode(error.message, error.message, 400);
    }

    return failWithCode("BAD_REQUEST", "Request could not be processed.", 400);
  }

  return failWithCode("INTERNAL_SERVER_ERROR", "Internal server error.", 500);
};
