CREATE TABLE "ClientDiagnosticReport" (
    "id" SERIAL NOT NULL,
    "publicId" TEXT NOT NULL,
    "userId" INTEGER,
    "reporterTelegramId" BIGINT NOT NULL,
    "code" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientDiagnosticReport_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SupportTicket" ADD COLUMN "diagnosticReportId" INTEGER;

CREATE UNIQUE INDEX "ClientDiagnosticReport_publicId_key" ON "ClientDiagnosticReport"("publicId");
CREATE INDEX "ClientDiagnosticReport_reporterTelegramId_createdAt_idx" ON "ClientDiagnosticReport"("reporterTelegramId", "createdAt");
CREATE INDEX "ClientDiagnosticReport_expiresAt_idx" ON "ClientDiagnosticReport"("expiresAt");
CREATE UNIQUE INDEX "SupportTicket_diagnosticReportId_key" ON "SupportTicket"("diagnosticReportId");

ALTER TABLE "ClientDiagnosticReport" ADD CONSTRAINT "ClientDiagnosticReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_diagnosticReportId_fkey" FOREIGN KEY ("diagnosticReportId") REFERENCES "ClientDiagnosticReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
