export const buildTelegramAvatarProxyUrl = (telegramId: bigint | string) =>
  `/api/telegram/proxy-image?telegramId=${encodeURIComponent(String(telegramId))}`;

export const withTelegramAvatar = <T extends { telegramId: bigint | string }>(user: T) => ({
  ...user,
  avatarUrl: buildTelegramAvatarProxyUrl(user.telegramId),
});
