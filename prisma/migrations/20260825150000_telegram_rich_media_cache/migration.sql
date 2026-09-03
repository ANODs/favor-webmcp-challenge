CREATE TABLE "TelegramRichMediaCache" (
    "cacheKey" TEXT NOT NULL,
    "botTokenFingerprint" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramRichMediaCache_pkey" PRIMARY KEY ("cacheKey")
);
