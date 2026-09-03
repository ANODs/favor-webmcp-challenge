import { PrismaClient } from "@prisma/client";

import {
  CATEGORY_TAXONOMY_VERSION,
  classifyContractCategory,
  getCategoryLabel,
  resolveCategoryId,
  type CategoryId,
} from "../../src/entities/category";
import { buildContractContentFingerprint } from "../../src/entities/contract/server/content-fingerprint";

const prisma = new PrismaClient();
const UPDATE_BATCH_SIZE = 100;

type CategoryMigrationDecision = {
  categoryId: CategoryId;
  confidence: "high" | "medium" | "low";
  source: "canonical" | "alias" | "context";
  evidence: string[];
};

const countBy = <T extends string>(values: readonly T[]) =>
  Object.fromEntries(
    [...new Set(values)].sort().map((value) => [
      value,
      values.filter((candidate) => candidate === value).length,
    ]),
  );

function decideContractCategory(contract: {
  category: string | null;
  scoutId: number | null;
  titleRu: string | null;
  titleEn: string | null;
  descriptionRu: string | null;
  descriptionEn: string | null;
  tags: string[];
}): CategoryMigrationDecision {
  const resolved = resolveCategoryId(contract.category);
  const classification = classifyContractCategory({
    titleRu: contract.titleRu,
    titleEn: contract.titleEn,
    descriptionRu: contract.descriptionRu,
    descriptionEn: contract.descriptionEn,
    tags: contract.tags,
  });

  // Imported channel categories were broad collection labels rather than the
  // profession in an individual post. Reclassify every scout contract from
  // its own content, even when the legacy label happens to be a valid alias.
  // `other.manual` is only a fallback, so retry it from context for ordinary
  // contracts too. Taxonomy v3 also splits the previously broad influencer
  // category when the content specifically describes TikTok promotion.
  const isLegacyTikTokPromo =
    resolved === "marketing.influencer" &&
    classification.categoryId === "marketing.tiktok_promo";
  const shouldClassifyFromContext =
    contract.scoutId !== null ||
    resolved === "other.manual" ||
    isLegacyTikTokPromo;

  if (!shouldClassifyFromContext && resolved) {
    return {
      categoryId: resolved,
      confidence: "high",
      source: contract.category === resolved ? "canonical" : "alias",
      evidence: contract.category === resolved ? [] : [`legacy:${contract.category}`],
    };
  }

  return {
    ...classification,
    source: "context",
  };
}

async function migrateContracts() {
  const contracts = await prisma.contract.findMany({
    select: {
      id: true,
      category: true,
      scoutId: true,
      titleRu: true,
      titleEn: true,
      descriptionRu: true,
      descriptionEn: true,
      tags: true,
      contentFingerprint: true,
    },
    orderBy: { id: "asc" },
  });

  const decisions = contracts.map((contract) => ({
    contract,
    decision: decideContractCategory(contract),
  }));
  const updates = decisions.flatMap(({ contract, decision }) => {
    const contentFingerprint = buildContractContentFingerprint({
      titleRu: contract.titleRu,
      titleEn: contract.titleEn,
      descriptionRu: contract.descriptionRu,
      descriptionEn: contract.descriptionEn,
      category: decision.categoryId,
      tags: contract.tags,
    });
    const categoryChanged = contract.category !== decision.categoryId;
    const fingerprintChanged = contract.contentFingerprint !== contentFingerprint;

    return categoryChanged || fingerprintChanged
      ? [{
          id: contract.id,
          categoryId: decision.categoryId,
          contentFingerprint,
          categoryChanged,
        }]
      : [];
  });

  for (let offset = 0; offset < updates.length; offset += UPDATE_BATCH_SIZE) {
    const batch = updates.slice(offset, offset + UPDATE_BATCH_SIZE);
    await prisma.$transaction(
      batch.map((update) =>
        prisma.contract.update({
          where: { id: update.id },
          data: {
            category: update.categoryId,
            contentFingerprint: update.contentFingerprint,
            ogImageBase64: update.categoryChanged ? null : undefined,
          },
        }),
      ),
    );
  }

  return {
    scanned: contracts.length,
    updated: updates.length,
    categoryChanged: updates.filter((update) => update.categoryChanged).length,
    scouted: contracts.filter((contract) => contract.scoutId !== null).length,
    confidence: countBy(decisions.map(({ decision }) => decision.confidence)),
    source: countBy(decisions.map(({ decision }) => decision.source)),
    categories: countBy(decisions.map(({ decision }) => decision.categoryId)),
    manual: decisions
      .filter(({ decision }) => decision.categoryId === "other.manual")
      .map(({ contract }) => contract.id),
  };
}

async function migrateAuctionsAndPromotions() {
  const now = new Date();
  const [auctions, promotions] = await Promise.all([
    prisma.categoryAuction.findMany({
      select: {
        id: true,
        categoryKey: true,
        categoryName: true,
        status: true,
      },
    }),
    prisma.categoryPromotion.findMany({
      select: {
        id: true,
        categoryKey: true,
        categoryName: true,
        startsAt: true,
        endsAt: true,
      },
    }),
  ]);

  const auctionTargets = auctions.map((auction) => ({
    ...auction,
    categoryId:
      resolveCategoryId(auction.categoryKey) ?? resolveCategoryId(auction.categoryName),
  }));
  const activeAuctionGroups = new Map<CategoryId, number[]>();
  for (const auction of auctionTargets) {
    if (!auction.categoryId || !["open", "awaiting_payment"].includes(auction.status)) continue;
    activeAuctionGroups.set(auction.categoryId, [
      ...(activeAuctionGroups.get(auction.categoryId) ?? []),
      auction.id,
    ]);
  }
  const collidingAuctionIds = new Set(
    [...activeAuctionGroups.values()].filter((ids) => ids.length > 1).flat(),
  );

  const promotionTargets = promotions.map((promotion) => ({
    ...promotion,
    categoryId:
      resolveCategoryId(promotion.categoryKey) ?? resolveCategoryId(promotion.categoryName),
  }));
  const activePromotionGroups = new Map<CategoryId, number[]>();
  for (const promotion of promotionTargets) {
    if (
      !promotion.categoryId ||
      promotion.startsAt > now ||
      promotion.endsAt <= now
    ) continue;
    activePromotionGroups.set(promotion.categoryId, [
      ...(activePromotionGroups.get(promotion.categoryId) ?? []),
      promotion.id,
    ]);
  }
  const collidingPromotionIds = new Set(
    [...activePromotionGroups.values()].filter((ids) => ids.length > 1).flat(),
  );

  const auctionUpdates = auctionTargets.filter(
    (auction) =>
      auction.categoryId &&
      !collidingAuctionIds.has(auction.id) &&
      (auction.categoryKey !== auction.categoryId ||
        auction.categoryName !== getCategoryLabel(auction.categoryId, "ru")),
  );
  const promotionUpdates = promotionTargets.filter(
    (promotion) =>
      promotion.categoryId &&
      !collidingPromotionIds.has(promotion.id) &&
      (promotion.categoryKey !== promotion.categoryId ||
        promotion.categoryName !== getCategoryLabel(promotion.categoryId, "ru")),
  );

  await prisma.$transaction([
    ...auctionUpdates.map((auction) =>
      prisma.categoryAuction.update({
        where: { id: auction.id },
        data: {
          categoryKey: auction.categoryId!,
          categoryName: getCategoryLabel(auction.categoryId, "ru")!,
        },
      }),
    ),
    ...promotionUpdates.map((promotion) =>
      prisma.categoryPromotion.update({
        where: { id: promotion.id },
        data: {
          categoryKey: promotion.categoryId!,
          categoryName: getCategoryLabel(promotion.categoryId, "ru")!,
        },
      }),
    ),
  ]);

  return {
    auctions: {
      scanned: auctions.length,
      updated: auctionUpdates.length,
      unmapped: auctionTargets.filter((auction) => !auction.categoryId).map((auction) => auction.id),
      activeCollisions: [...activeAuctionGroups.entries()]
        .filter(([, ids]) => ids.length > 1)
        .map(([categoryId, ids]) => ({ categoryId, ids })),
    },
    promotions: {
      scanned: promotions.length,
      updated: promotionUpdates.length,
      unmapped: promotionTargets
        .filter((promotion) => !promotion.categoryId)
        .map((promotion) => promotion.id),
      activeCollisions: [...activePromotionGroups.entries()]
        .filter(([, ids]) => ids.length > 1)
        .map(([categoryId, ids]) => ({ categoryId, ids })),
    },
  };
}

async function main() {
  const startedAt = new Date();
  const contracts = await migrateContracts();
  const dependentRecords = await migrateAuctionsAndPromotions();

  console.info(JSON.stringify({
    migration: "standardize-contract-categories-v1",
    taxonomyVersion: CATEGORY_TAXONOMY_VERSION,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    contracts,
    ...dependentRecords,
  }));
}

main()
  .catch((error) => {
    console.error("[category-standardization] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
