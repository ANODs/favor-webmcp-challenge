type UserSlugSource = {
  id: number;
  telegramUsername?: string | null;
};

export const normalizeTelegramUsername = (value?: string | null) =>
  value?.trim().replace(/^@/, "").toLowerCase() || null;

export const getUserProfileSlug = ({ id, telegramUsername }: UserSlugSource) => {
  const normalizedUsername = normalizeTelegramUsername(telegramUsername);

  return normalizedUsername || `id-${id}`;
};

export const parseUserProfileSlug = (slug: string) => {
  const normalizedSlug = slug.trim().replace(/^@/, "").toLowerCase();

  if (/^id-\d+$/.test(normalizedSlug)) {
    return {
      id: Number(normalizedSlug.slice(3)),
      telegramUsername: null,
    };
  }

  return {
    id: null,
    telegramUsername: normalizedSlug,
  };
};
