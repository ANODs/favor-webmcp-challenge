/* eslint-disable @typescript-eslint/no-require-imports */
const { prisma } = require("./prisma");

const BLOCKING_SCOPES = {
  support: ["login_lock", "support"],
  communication: ["login_lock", "all_writes", "communication"],
};

async function getBlockingRestriction(telegramId, capability) {
  const scopes = BLOCKING_SCOPES[capability];
  if (!telegramId || !scopes) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(telegramId) },
    select: {
      id: true,
      accountRestrictions: {
        where: {
          scope: { in: scopes },
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return user?.accountRestrictions[0]
    ? { ...user.accountRestrictions[0], userId: user.id }
    : null;
}

module.exports = { getBlockingRestriction };
