import { env } from "@/shared/config/env";

export function GET() {
  return Response.json({
    url: env.baseUrl,
    name: "Favor",
    iconUrl: `${env.baseUrl}/favicon.ico`,
    termsOfUseUrl: env.baseUrl,
    privacyPolicyUrl: env.baseUrl,
  });
}
