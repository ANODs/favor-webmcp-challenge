import { Prisma } from "@prisma/client";

import { ensureUniqueSlugWithClient } from "@/shared/lib/slug";

const CONTRACT_SLUG_ALLOCATION_LOCK_ID = 1_866_483_177;

export async function allocateUniqueContractSlug(
  tx: Prisma.TransactionClient,
  baseTitle: string,
  excludeId?: number,
) {
  await tx.$queryRaw<Array<{ lock: string }>>`
    SELECT pg_advisory_xact_lock(
      ${CONTRACT_SLUG_ALLOCATION_LOCK_ID}
    )::text AS "lock"
  `;

  return ensureUniqueSlugWithClient(tx, baseTitle, excludeId);
}
