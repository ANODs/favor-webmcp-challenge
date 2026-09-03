import {
  formatDiagnosticSnapshot,
  type DiagnosticSnapshot,
} from "@/shared/lib/client-diagnostics";

export const copyDiagnosticSnapshot = async (snapshot: DiagnosticSnapshot) => {
  const value = formatDiagnosticSnapshot(snapshot);

  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();

    if (!copied) throw new Error("Clipboard API is unavailable");
  }
};
