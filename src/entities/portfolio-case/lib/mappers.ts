import { Prisma } from "@prisma/client";
import { type PortfolioCaseDto } from "../api/dto";

const portfolioCaseSelect = {
  id: true,
  userId: true,
  title: true,
  description: true,
  telegramPostUrl: true,
  links: true,
  contractId: true,
  createdAt: true,
  updatedAt: true,
  contract: {
    select: {
      id: true,
      slug: true,
      titleRu: true,
      titleEn: true,
    },
  },
} satisfies Prisma.PortfolioCaseSelect;

export type PortfolioCaseRecord = Prisma.PortfolioCaseGetPayload<{
  select: typeof portfolioCaseSelect;
}>;

export const normalizePortfolioLinks = (value: Prisma.JsonValue) => {
  if (!Array.isArray(value)) {
    return null;
  }

  const links = value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }

    const url = "url" in item && typeof item.url === "string" ? item.url : null;
    const label = "label" in item && typeof item.label === "string" ? item.label : undefined;

    if (!url) {
      return [];
    }

    return [{ url, label }];
  });

  return links.length ? links : null;
};

export const toPortfolioCase = (caseData: PortfolioCaseRecord): PortfolioCaseDto => ({
  id: caseData.id,
  userId: caseData.userId,
  title: caseData.title,
  description: caseData.description,
  telegramPostUrl: caseData.telegramPostUrl,
  links: normalizePortfolioLinks(caseData.links),
  contractId: caseData.contractId,
  contract: caseData.contract
    ? {
        id: caseData.contract.id,
        slug: caseData.contract.slug,
        titleRu: caseData.contract.titleRu,
        titleEn: caseData.contract.titleEn,
      }
    : null,
  createdAt: caseData.createdAt.toISOString(),
  updatedAt: caseData.updatedAt.toISOString(),
});
export { portfolioCaseSelect };
