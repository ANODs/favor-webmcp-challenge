-- CreateTable
CREATE TABLE "UserBadgeDefinition" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "labelRu" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "descriptionRu" TEXT NOT NULL,
    "descriptionEn" TEXT NOT NULL,
    "iconKey" TEXT NOT NULL,
    "tone" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdByModeratorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserBadgeDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBadgeAssignment" (
    "userId" INTEGER NOT NULL,
    "badgeId" INTEGER NOT NULL,
    "assignedByModeratorId" INTEGER,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBadgeAssignment_pkey" PRIMARY KEY ("userId", "badgeId")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserBadgeDefinition_code_key" ON "UserBadgeDefinition"("code");

-- CreateIndex
CREATE INDEX "UserBadgeDefinition_sortOrder_id_idx" ON "UserBadgeDefinition"("sortOrder", "id");

-- CreateIndex
CREATE INDEX "UserBadgeDefinition_createdByModeratorId_createdAt_idx" ON "UserBadgeDefinition"("createdByModeratorId", "createdAt");

-- CreateIndex
CREATE INDEX "UserBadgeAssignment_badgeId_idx" ON "UserBadgeAssignment"("badgeId");

-- CreateIndex
CREATE INDEX "UserBadgeAssignment_assignedByModeratorId_assignedAt_idx" ON "UserBadgeAssignment"("assignedByModeratorId", "assignedAt");

-- AddForeignKey
ALTER TABLE "UserBadgeDefinition" ADD CONSTRAINT "UserBadgeDefinition_createdByModeratorId_fkey" FOREIGN KEY ("createdByModeratorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadgeAssignment" ADD CONSTRAINT "UserBadgeAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadgeAssignment" ADD CONSTRAINT "UserBadgeAssignment_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "UserBadgeDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadgeAssignment" ADD CONSTRAINT "UserBadgeAssignment_assignedByModeratorId_fkey" FOREIGN KEY ("assignedByModeratorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the system alpha badge. Application-created badges use random UUID codes.
INSERT INTO "UserBadgeDefinition" (
    "code",
    "labelRu",
    "labelEn",
    "descriptionRu",
    "descriptionEn",
    "iconKey",
    "tone",
    "sortOrder",
    "createdByModeratorId",
    "createdAt",
    "updatedAt"
)
VALUES (
    'alpha_user',
    'Альфа-пользователь',
    'Alpha user',
    'Присоединился к Favor на этапе альфа-тестирования.',
    'Joined Favor during the alpha testing stage.',
    'sparkles',
    'brand-accent',
    0,
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- Only users present when this migration runs receive the alpha badge.
INSERT INTO "UserBadgeAssignment" (
    "userId",
    "badgeId",
    "assignedByModeratorId",
    "assignedAt"
)
SELECT
    "User"."id",
    "UserBadgeDefinition"."id",
    NULL,
    CURRENT_TIMESTAMP
FROM "User"
CROSS JOIN "UserBadgeDefinition"
WHERE "UserBadgeDefinition"."code" = 'alpha_user';
