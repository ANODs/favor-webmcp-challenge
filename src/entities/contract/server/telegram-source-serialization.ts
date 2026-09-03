type ContractTelegramSourceFields = {
  telegramPostUrl: string | null;
  telegramChannelUrl: string | null;
  cachedTelegramText: string | null;
  scoutedTelegramUsername: string | null;
};

type ContractWithTelegramSource = Partial<ContractTelegramSourceFields> & {
  authorId: number;
  scoutId?: number | null;
};

type ContractTelegramSourceViewer = {
  id: number;
  role?: string | null;
};

type ContractTelegramSourceVisibility = {
  revealTelegramLinks?: boolean;
};

type ContractScoutIdentity = {
  id: number;
  name: string | null;
  telegramUsername: string | null;
  isTelegramUsernameHidden: boolean;
};

type ViewerSafeContract<T extends ContractWithTelegramSource> = Omit<
  T,
  keyof ContractTelegramSourceFields
> &
  ContractTelegramSourceFields;

export const serializeContractTelegramSourceForViewer = <
  T extends ContractWithTelegramSource,
>(
  contract: T,
  viewer?: ContractTelegramSourceViewer | null,
  visibility: ContractTelegramSourceVisibility = {},
): ViewerSafeContract<T> => {
  const canViewPrivateTelegramSource =
    viewer != null &&
    (viewer.role === "moderator" ||
      viewer.id === contract.authorId ||
      viewer.id === contract.scoutId);
  const canViewTelegramLinks =
    canViewPrivateTelegramSource || visibility.revealTelegramLinks === true;

  return {
    ...contract,
    telegramPostUrl: canViewTelegramLinks
      ? (contract.telegramPostUrl ?? null)
      : null,
    telegramChannelUrl: canViewTelegramLinks
      ? (contract.telegramChannelUrl ?? null)
      : null,
    cachedTelegramText: canViewPrivateTelegramSource
      ? (contract.cachedTelegramText ?? null)
      : null,
    scoutedTelegramUsername: canViewPrivateTelegramSource
      ? (contract.scoutedTelegramUsername ?? null)
      : null,
  };
};

export const serializeContractScoutForFeedViewer = <
  T extends ContractScoutIdentity,
>(
  scout: T | null,
  viewer?: ContractTelegramSourceViewer | null,
): T | null => {
  if (!scout) {
    return null;
  }

  const canViewScoutIdentity =
    viewer != null &&
    (viewer.role === "moderator" || viewer.id === scout.id);

  return {
    ...scout,
    name: canViewScoutIdentity ? scout.name : null,
    telegramUsername:
      canViewScoutIdentity && !scout.isTelegramUsernameHidden
        ? scout.telegramUsername
        : null,
  };
};
