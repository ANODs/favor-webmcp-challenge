CREATE INDEX "User_createdAt_id_idx" ON "User"("createdAt", "id");

CREATE INDEX "Contract_status_createdAt_id_idx" ON "Contract"("status", "createdAt", "id");

CREATE INDEX "Contract_createdAt_id_idx" ON "Contract"("createdAt", "id");
