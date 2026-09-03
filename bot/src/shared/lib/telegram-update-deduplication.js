/* eslint-disable @typescript-eslint/no-require-imports */
const { prisma } = require("./prisma");

async function isTelegramUpdateProcessed(updateId, database = prisma) {
  const processedUpdate = await database.processedTelegramUpdate.findUnique({
    where: { updateId: BigInt(updateId) },
    select: { updateId: true },
  });

  return Boolean(processedUpdate);
}

async function registerTelegramUpdate(updateId, database = prisma) {
  try {
    await database.processedTelegramUpdate.create({
      data: { updateId: BigInt(updateId) },
    });
    return true;
  } catch (error) {
    if (error?.code === "P2002") {
      return false;
    }

    throw error;
  }
}

module.exports = {
  isTelegramUpdateProcessed,
  registerTelegramUpdate,
};
