import { apiRequest } from "@/shared/api";

import type { PortfolioCaseDto, PortfolioLinkDto } from "./dto";

export type CreatePortfolioCasePayload = {
  title: string;
  description?: string | null;
  telegramPostUrl?: string | null;
  links?: PortfolioLinkDto[] | null;
  contractId?: number | null;
};

class PortfolioClient {
  async createCase(payload: CreatePortfolioCasePayload): Promise<PortfolioCaseDto> {
    return apiRequest<PortfolioCaseDto>({
      path: "/api/portfolio",
      init: {
        method: "POST",
        body: JSON.stringify(payload),
      },
    });
  }

  async deleteCase(id: number): Promise<void> {
    await apiRequest<{ success: boolean }>({
      path: `/api/portfolio/${id}`,
      init: {
        method: "DELETE",
      },
    });
  }
}

export const portfolioClient = new PortfolioClient();
