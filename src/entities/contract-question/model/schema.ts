import { z } from "zod";

export const askContractQuestionSchema = z.object({
  question: z.string().trim().min(5).max(1000),
});
