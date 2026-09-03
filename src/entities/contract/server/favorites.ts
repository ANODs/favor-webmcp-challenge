import { prisma } from "@/shared/lib/prisma";

export async function setContractFavorite({
  userId,
  slug,
  isFavorite,
}: {
  userId: number;
  slug: string;
  isFavorite: boolean;
}) {
  const contract = await prisma.contract.findUnique({
    where: { slug },
    select: { id: true, slug: true },
  });

  if (!contract) {
    throw new Error("NOT_FOUND");
  }

  if (isFavorite) {
    await prisma.contractFavorite.upsert({
      where: {
        userId_contractId: {
          userId,
          contractId: contract.id,
        },
      },
      update: {},
      create: {
        userId,
        contractId: contract.id,
      },
    });
  } else {
    await prisma.contractFavorite.deleteMany({
      where: {
        userId,
        contractId: contract.id,
      },
    });
  }

  return {
    contractId: contract.id,
    slug: contract.slug,
    isFavorite,
  };
}
