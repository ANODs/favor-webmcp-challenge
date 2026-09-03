import type { DiagnosticSnapshot } from "@/shared/lib/client-diagnostics";
import { openTelegramProblemReport } from "@/shared/lib/telegram";

import { submitClientDiagnosticReport } from "../api/client";
import { copyDiagnosticSnapshot } from "./copy-diagnostic";

export async function openDiagnosticSupport(snapshot: DiagnosticSnapshot) {
  try {
    const report = await submitClientDiagnosticReport(snapshot);
    openTelegramProblemReport(report.publicId);
    return "attached" as const;
  } catch {
    await copyDiagnosticSnapshot(snapshot).catch(() => undefined);
    openTelegramProblemReport();
    return "clipboard-fallback" as const;
  }
}
