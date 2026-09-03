CREATE TABLE "AppRelease" (
    "id" SERIAL NOT NULL,
    "commitSha" VARCHAR(64) NOT NULL,
    "patch" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppRelease_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AppRelease_patch_nonnegative_check" CHECK ("patch" >= 0)
);

CREATE UNIQUE INDEX "AppRelease_commitSha_key" ON "AppRelease"("commitSha");
CREATE UNIQUE INDEX "AppRelease_patch_key" ON "AppRelease"("patch");
