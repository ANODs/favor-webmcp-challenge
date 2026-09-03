import type { ContractDto } from "@/entities/contract";
import { apiRequest } from "@/shared/api";

export const moderationClient = {
  approveContract(id: number) {
    return apiRequest<ContractDto>({
      path: `/api/moderation/contracts/${id}/approve`,
      init: { method: "POST" },
    });
  },
  rejectContract(id: number, comment: string) {
    return apiRequest<ContractDto>({
      path: `/api/moderation/contracts/${id}/reject`,
      init: {
        method: "POST",
        body: JSON.stringify({ comment }),
      },
    });
  },
  archiveContract(id: number, comment: string) {
    return apiRequest<ContractDto>({
      path: `/api/moderation/contracts/${id}/archive`,
      init: {
        method: "POST",
        body: JSON.stringify({ comment }),
      },
    });
  },
};
