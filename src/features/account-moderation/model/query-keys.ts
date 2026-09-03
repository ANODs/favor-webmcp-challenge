export const accountModerationQueryKeys = {
  all: ["account-moderation"] as const,
  lists: () => ["account-moderation", "users"] as const,
  list: (search: string) =>
    ["account-moderation", "users", { search: search.trim() }] as const,
  badgeCatalog: ["account-moderation", "badges"] as const,
};
