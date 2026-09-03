import { env } from "@/shared/config/env";

import { ApplicationError } from "./application-error";

export const assertSameOriginJsonRequest = (request: Request) => {
  const origin = request.headers.get("origin");
  const expectedOrigin = new URL(env.baseUrl).origin;
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

  if (origin && origin !== expectedOrigin) {
    throw new ApplicationError(
      "CROSS_ORIGIN_REQUEST_REJECTED",
      "Cross-origin requests are not allowed.",
      403,
    );
  }

  if (!contentType.startsWith("application/json")) {
    throw new ApplicationError(
      "JSON_CONTENT_TYPE_REQUIRED",
      "The request must use application/json.",
      415,
    );
  }
};
