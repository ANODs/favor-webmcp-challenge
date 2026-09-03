import crypto from "node:crypto";

import { env } from "@/shared/config/env";

export function getRequestIp(request: Request) {
  const cloudflareIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cloudflareIp) {
    return cloudflareIp;
  }

  const forwardedIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedIp || "unknown";
}

export const hashRequestIp = (request: Request) =>
  crypto
    .createHmac("sha256", env.abuseIpHashSecret)
    .update(getRequestIp(request))
    .digest("hex")
    .slice(0, 32);
