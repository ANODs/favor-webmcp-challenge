import { apiRequest } from "@/shared/api";
import type { DiagnosticSnapshot } from "@/shared/lib/client-diagnostics";

type CreateReportResponse = {
  publicId: string;
  expiresAt: string;
};

export const submitClientDiagnosticReport = (snapshot: DiagnosticSnapshot) =>
  apiRequest<CreateReportResponse>({
    path: "/api/telegram/client-error-reports",
    init: {
      method: "POST",
      body: JSON.stringify(snapshot),
    },
  });
