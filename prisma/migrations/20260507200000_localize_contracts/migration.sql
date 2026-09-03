-- AlterTable
ALTER TABLE "User" ADD COLUMN "languageCode" TEXT NOT NULL DEFAULT 'ru';

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN "titleRu" TEXT;
ALTER TABLE "Contract" ADD COLUMN "titleEn" TEXT;
ALTER TABLE "Contract" ADD COLUMN "descriptionRu" TEXT;
ALTER TABLE "Contract" ADD COLUMN "descriptionEn" TEXT;

-- Safe Data Migration: Move existing data to Ru columns and drop old columns
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Contract' AND column_name='title') THEN
    UPDATE "Contract" SET "titleRu" = "title", "descriptionRu" = "description";
    ALTER TABLE "Contract" DROP COLUMN "title";
    ALTER TABLE "Contract" DROP COLUMN "description";
  END IF;
END $$;

-- Fallback Data Migration: For contracts that lost their titles, restore from cachedTelegramText
UPDATE "Contract"
SET 
  "titleRu" = substring("cachedTelegramText" from '^[^\n]+'),
  "descriptionRu" = "cachedTelegramText"
WHERE "titleRu" IS NULL AND "titleEn" IS NULL AND "cachedTelegramText" IS NOT NULL;
