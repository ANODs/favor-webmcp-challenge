export const routes = {
  home: "/",
  feed: "/feed",
  onboarding: "/onboarding",
  deals: "/deals",
  createContract: "/contracts/new",
  profile: "/profile",
  settings: "/settings",
  moderation: "/moderation",
  contractBySlug: (slug: string) => `/contracts/${slug}`,
  editContractBySlug: (slug: string) => `/contracts/${slug}/edit`,
  dealById: (id: number) => `/deals/${id}`,
  profileBySlug: (slug: string) => `/profile/${slug}`,
  terms: "/terms",
  privacy: "/privacy",
  authRequired: "/?auth=required",
  telegramRequired: "/?telegram=required",
} as const;

export const protectedRoutePrefixes = [
  routes.deals,
  routes.settings,
  routes.moderation,
] as const;

export const protectedRouteMatcher = [
  "/deals/:path*",
  "/contracts/:path*",
  "/settings/:path*",
  "/moderation/:path*",
] as const;
