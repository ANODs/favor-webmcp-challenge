export const contractQuestionQueryKeys = {
  all: ["contract-questions"] as const,
  byContract: (slug: string) => ["contract-questions", slug] as const,
};
