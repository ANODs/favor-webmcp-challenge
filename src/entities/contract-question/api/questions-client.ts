import { apiRequest } from "@/shared/api";

import type { AskContractQuestionDto, ContractQuestionsDto } from "./dto";

export const contractQuestionsClient = {
  getByContract(slug: string) {
    return apiRequest<ContractQuestionsDto>({
      path: `/api/contracts/${slug}/questions`,
      init: { method: "GET" },
    });
  },
  ask(slug: string, question: string) {
    return apiRequest<AskContractQuestionDto>({
      path: `/api/contracts/${slug}/questions`,
      init: {
        method: "POST",
        body: JSON.stringify({ question }),
      },
    });
  },
};
