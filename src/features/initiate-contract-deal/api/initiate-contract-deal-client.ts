import type { DealDto } from "@/entities/deal";
import { apiRequest } from "@/shared/api";

import type { InitiateContractDealPayload } from "../model/schema";

export const initiateContractDealClient = {
  create(slug: string, payload: InitiateContractDealPayload) {
    return apiRequest<DealDto>({
      path: `/api/contracts/${slug}/initiate`,
      init: {
        method: "POST",
        body: JSON.stringify(payload),
      },
    });
  },
};
