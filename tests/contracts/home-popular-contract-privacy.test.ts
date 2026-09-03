import assert from "node:assert/strict";
import test from "node:test";
import {
  ContractStatus,
  ContractType,
  EscrowCurrency,
} from "@prisma/client";

import { toPublicPopularContract } from "../../src/views/home-view/server";

test("public popular contracts do not expose Telegram source links", () => {
  const telegramPostUrl = "https://t.me/freelance/123";
  const telegramChannelUrl = "https://t.me/freelance";
  const contract = {
    id: 42,
    authorId: 10,
    titleRu: "Нужен разработчик",
    titleEn: null,
    slug: "nuzhen-razrabotchik",
    descriptionRu: "Нужен разработчик для долгосрочного проекта.",
    descriptionEn: null,
    type: ContractType.order,
    category: "development",
    tags: ["typescript"],
    basePrice: null,
    deadlineDays: null,
    maxOpenDeals: 1,
    status: ContractStatus.active,
    moderationComment: null,
    telegramPostUrl,
    telegramChannelUrl,
    mediaRefs: [],
    isEscrow: false,
    escrowCurrency: EscrowCurrency.TON,
    createdAt: new Date("2026-08-25T10:00:00.000Z"),
    updatedAt: new Date("2026-08-25T11:00:00.000Z"),
  };

  const result = toPublicPopularContract(contract, {
    uniqueViewsCount: 12,
    completedDealsCount: 3,
    averageRating: 4.8,
    reviewsCount: 5,
  });

  assert.equal(result.telegramPostUrl, null);
  assert.equal(result.telegramChannelUrl, null);
  assert.equal(result.title, contract.titleRu);
  assert.equal(result.uniqueViewsCount, 12);
  assert.equal(result.completedDealsCount, 3);
});
