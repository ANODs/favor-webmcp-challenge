import { apiRequest } from "@/shared/api";

import type {
  ClaimedContractPublicationDraftDto,
  ContractPublicationDraftData,
  PreparedContractPublicationDraftDto,
} from "../model/publication-draft";

export const contractPublicationDraftsClient = {
  prepare(
    data: ContractPublicationDraftData,
    options?: { signal?: AbortSignal },
  ) {
    return apiRequest<PreparedContractPublicationDraftDto>({
      path: "/api/contract-publication-drafts",
      init: {
        method: "POST",
        body: JSON.stringify({ data }),
        signal: options?.signal,
      },
    });
  },

  claim(token: string) {
    return apiRequest<ClaimedContractPublicationDraftDto>({
      path: "/api/contract-publication-drafts/claim",
      init: {
        method: "POST",
        body: JSON.stringify({ token }),
      },
    });
  },
};
