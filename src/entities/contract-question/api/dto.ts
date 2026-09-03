export type ContractQuestionDto = {
  id: number;
  question: string;
  answer: string;
  createdAt: string;
  publishedAt: string | null;
};

export type ContractQuestionsDto = {
  enabled: boolean;
  total: number;
  items: ContractQuestionDto[];
};

export type AskContractQuestionDto = {
  id: number;
  delivered: boolean;
};
