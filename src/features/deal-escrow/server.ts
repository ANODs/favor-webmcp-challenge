import { prisma } from "@/shared/lib/prisma";

import { activateFundedDealWithDependencies } from "./server/activate-funded-deal";

export {
  activateFundedDealWithDependencies,
  getFundedDealExecutionTiming,
  type ActivateFundedDealTransactionRunner,
} from "./server/activate-funded-deal";

export const activateFundedDeal = (
  input: Omit<
    Parameters<typeof activateFundedDealWithDependencies>[0],
    "runTransaction"
  >,
) =>
  activateFundedDealWithDependencies({
    ...input,
    runTransaction: (operation) => prisma.$transaction(operation),
  });
