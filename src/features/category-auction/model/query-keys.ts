export const categoryAuctionQueryKeys = {
  state: (categoryName: string) => ["category-auction", categoryName] as const,
  favorBalance: (walletAddress: string) => ["favor-balance", walletAddress] as const,
};
