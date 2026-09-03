export type PortfolioLinkDto = {
  url: string;
  label?: string;
};

export type PortfolioCaseContractDto = {
  id: number;
  slug: string;
  titleRu: string | null;
  titleEn: string | null;
};

export type PortfolioCaseDto = {
  id: number;
  userId: number;
  title: string;
  description: string | null;
  telegramPostUrl: string | null;
  links: PortfolioLinkDto[] | null;
  contractId: number | null;
  contract: PortfolioCaseContractDto | null;
  createdAt: string;
  updatedAt: string;
};
