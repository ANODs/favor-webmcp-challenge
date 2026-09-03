import type {
  DiagnosticSnapshot,
  RecoverableErrorOptions,
} from "@/shared/lib/client-diagnostics";

export type ErrorFeedbackOptions = RecoverableErrorOptions;

export type ActiveErrorFeedback = {
  snapshot: DiagnosticSnapshot;
  options: ErrorFeedbackOptions;
  occurrences: number;
};

export type ErrorFeedbackContextValue = {
  reportError: (error: unknown, options: ErrorFeedbackOptions) => string;
  dismissError: () => void;
};
