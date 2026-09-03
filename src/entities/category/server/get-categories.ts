import { ContractStatus } from "@prisma/client";

import { prisma } from "@/shared/lib/prisma";

import {
  CATEGORY_CATALOG,
  resolveCategoryId,
  type CategoryItem,
} from "../model/constants";

export async function getCategoriesWithRelevance(userId?: number): Promise<CategoryItem[]> {
  const [dbGrouped, promotions] = await Promise.all([
    prisma.contract.groupBy({
      by: ["category"],
      _count: { id: true },
      where: {
        category: { not: null },
        status: ContractStatus.active,
      },
      orderBy: { _count: { id: "desc" } },
    }),
    userId
      ? prisma.categoryPromotion.findMany({
          where: {
            userId,
            startsAt: { lte: new Date() },
            endsAt: { gt: new Date() },
          },
          select: {
            id: true,
            categoryKey: true,
            categoryName: true,
            endsAt: true,
            assignedContractId: true,
            source: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const countsById = new Map(CATEGORY_CATALOG.map((category) => [category.id, 0]));

  for (const item of dbGrouped) {
    const categoryId = resolveCategoryId(item.category);
    if (!categoryId) continue;
    countsById.set(categoryId, (countsById.get(categoryId) ?? 0) + item._count.id);
  }

  const promotionsById = new Map(
    promotions.flatMap((promotion) => {
      const categoryId =
        resolveCategoryId(promotion.categoryKey) ?? resolveCategoryId(promotion.categoryName);
      return categoryId ? [[categoryId, promotion] as const] : [];
    }),
  );

  const categories: CategoryItem[] = CATEGORY_CATALOG.map((category) => {
    const promotion = promotionsById.get(category.id);
    return {
      id: category.id,
      labelRu: category.labels.ru,
      labelEn: category.labels.en,
      count: countsById.get(category.id) ?? 0,
      myPromotion: promotion
        ? {
            id: promotion.id,
            endsAt: promotion.endsAt.toISOString(),
            assignedContractId: promotion.assignedContractId,
            source: promotion.source,
          }
        : null,
    };
  });

  categories.sort((left, right) => {
    if (left.myPromotion && !right.myPromotion) return -1;
    if (!left.myPromotion && right.myPromotion) return 1;
    if (right.count !== left.count) return right.count - left.count;
    return left.labelRu.localeCompare(right.labelRu, "ru-RU");
  });

  return categories;
}
