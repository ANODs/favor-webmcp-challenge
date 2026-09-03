const MAX_BREADCRUMBS = 20;
const MAX_TEXT_LENGTH = 2_000;
const MAX_STACK_LENGTH = 5_000;

export type DiagnosticPrimitive = string | number | boolean | null;

export type DiagnosticBreadcrumb = {
  timestamp: string;
  category: "action" | "api" | "navigation" | "story" | "system";
  name: string;
  outcome?: "started" | "success" | "failure" | "info";
  metadata?: Record<string, DiagnosticPrimitive>;
};

export type DiagnosticSnapshot = {
  id: string;
  code: string;
  fingerprint: string;
  area: string;
  message: string;
  stack?: string;
  timestamp: string;
  route?: string;
  locale: "ru" | "en";
  context: Record<string, DiagnosticPrimitive>;
  breadcrumbs: DiagnosticBreadcrumb[];
};

type DiagnosticErrorOptions = {
  cause?: unknown;
  metadata?: Record<string, DiagnosticPrimitive>;
};

type SnapshotOptions = {
  code: string;
  area: string;
  metadata?: Record<string, DiagnosticPrimitive>;
};

export type RecoverableErrorOptions = SnapshotOptions & {
  title: string;
  description?: string;
  retry?: () => void | Promise<void>;
};

type RecoverableErrorReporter = (
  error: unknown,
  options: RecoverableErrorOptions,
) => string;

const breadcrumbs: DiagnosticBreadcrumb[] = [];
let recoverableErrorReporter: RecoverableErrorReporter | null = null;
const pendingRecoverableErrors: Array<{
  error: unknown;
  options: RecoverableErrorOptions;
}> = [];

const sanitizeText = (value: string, maxLength = MAX_TEXT_LENGTH) =>
  value
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(
      /\b(query_id|user|receiver|chat_instance|auth_date|signature|hash|token|initData)=([^&\s]+)/gi,
      "$1=[redacted]",
    )
    .replace(/([?&](?:token|key|secret|signature|hash|initData)=)[^&\s]+/gi, "$1[redacted]")
    .slice(0, maxLength);

const normalizeCode = (value: string) => {
  const normalized = value.toUpperCase().replace(/[^A-Z0-9_]/g, "_").slice(0, 64);
  return normalized || "UNEXPECTED_CLIENT_ERROR";
};

const normalizeArea = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(0, 64) || "app";

const sanitizeMetadata = (metadata?: Record<string, DiagnosticPrimitive>) => {
  if (!metadata) return undefined;

  return Object.fromEntries(
    Object.entries(metadata)
      .slice(0, 24)
      .map(([key, value]) => [
        key.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 64),
        typeof value === "string" ? sanitizeText(value, 500) : value,
      ]),
  );
};

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `fallback-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const hashFingerprint = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase().padStart(7, "0");
};

const getError = (error: unknown) => {
  if (error instanceof Error) return error;
  return new Error(typeof error === "string" ? error : "Unknown client error");
};

const getLocale = (): "ru" | "en" =>
  typeof document !== "undefined" && document.documentElement.lang === "en" ? "en" : "ru";

const getRoute = () =>
  typeof window === "undefined" ? undefined : sanitizeText(window.location.pathname, 500);

const getRuntimeContext = (): Record<string, DiagnosticPrimitive> => {
  if (typeof window === "undefined" || typeof navigator === "undefined") return {};

  const telegram = window.Telegram?.WebApp;
  return {
    online: navigator.onLine,
    platform: telegram?.platform ?? "web",
    telegramVersion: telegram?.version ?? null,
    telegramColorScheme: telegram?.colorScheme ?? null,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    devicePixelRatio: Number(window.devicePixelRatio.toFixed(2)),
    hardwareConcurrency: navigator.hardwareConcurrency ?? null,
    userAgent: sanitizeText(navigator.userAgent, 500),
  };
};

export class DiagnosticError extends Error {
  readonly code: string;
  readonly metadata?: Record<string, DiagnosticPrimitive>;

  constructor(code: string, message: string, options: DiagnosticErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "DiagnosticError";
    this.code = normalizeCode(code);
    this.metadata = sanitizeMetadata(options.metadata);
  }
}

export const recordDiagnosticBreadcrumb = (
  breadcrumb: Omit<DiagnosticBreadcrumb, "timestamp"> & { timestamp?: string },
) => {
  breadcrumbs.push({
    ...breadcrumb,
    timestamp: breadcrumb.timestamp ?? new Date().toISOString(),
    name: sanitizeText(breadcrumb.name, 120),
    metadata: sanitizeMetadata(breadcrumb.metadata),
  });

  if (breadcrumbs.length > MAX_BREADCRUMBS) {
    breadcrumbs.splice(0, breadcrumbs.length - MAX_BREADCRUMBS);
  }
};

export const getDiagnosticBreadcrumbs = () => breadcrumbs.map((item) => ({ ...item }));

export const registerRecoverableErrorReporter = (reporter: RecoverableErrorReporter) => {
  recoverableErrorReporter = reporter;
  const pending = pendingRecoverableErrors.splice(0);
  if (pending.length) {
    queueMicrotask(() => {
      pending.forEach((item) => reporter(item.error, item.options));
    });
  }
  return () => {
    if (recoverableErrorReporter === reporter) recoverableErrorReporter = null;
  };
};

export const reportRecoverableError = (
  error: unknown,
  options: RecoverableErrorOptions,
) => {
  if (recoverableErrorReporter) return recoverableErrorReporter(error, options);

  pendingRecoverableErrors.push({ error, options });
  if (pendingRecoverableErrors.length > 3) pendingRecoverableErrors.shift();
  console.error(`[${options.code}] ${options.title}`, error);
  return null;
};

export const createDiagnosticSnapshot = (
  error: unknown,
  options: SnapshotOptions,
): DiagnosticSnapshot => {
  const resolvedError = getError(error);
  const diagnosticError = resolvedError instanceof DiagnosticError ? resolvedError : null;
  const code = normalizeCode(diagnosticError?.code ?? options.code);
  const message = sanitizeText(resolvedError.message || "Unknown client error");
  const stack = resolvedError.stack
    ? sanitizeText(resolvedError.stack, MAX_STACK_LENGTH)
        .split("\n")
        .slice(0, 12)
        .join("\n")
    : undefined;
  const metadata = sanitizeMetadata({
    ...options.metadata,
    ...diagnosticError?.metadata,
  });
  const fingerprint = hashFingerprint(
    `${code}|${message}|${stack?.split("\n")[1] ?? ""}|${getRoute() ?? ""}`,
  );

  return {
    id: createId(),
    code,
    fingerprint,
    area: normalizeArea(options.area),
    message,
    ...(stack ? { stack } : {}),
    timestamp: new Date().toISOString(),
    route: getRoute(),
    locale: getLocale(),
    context: {
      ...getRuntimeContext(),
      ...metadata,
    },
    breadcrumbs: getDiagnosticBreadcrumbs(),
  };
};

export const formatDiagnosticSnapshot = (snapshot: DiagnosticSnapshot) => {
  const context = Object.entries(snapshot.context)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join("\n");
  const history = snapshot.breadcrumbs
    .map((item) => {
      const metadata = item.metadata
        ? ` · ${Object.entries(item.metadata)
            .map(([key, value]) => `${key}=${String(value)}`)
            .join(", ")}`
        : "";
      return `${item.timestamp} · ${item.category}/${item.name} · ${item.outcome ?? "info"}${metadata}`;
    })
    .join("\n");

  return [
    `Favor error ${snapshot.code}`,
    `Report ID: ${snapshot.id}`,
    `Fingerprint: ${snapshot.fingerprint}`,
    `Time: ${snapshot.timestamp}`,
    `Area: ${snapshot.area}`,
    `Route: ${snapshot.route ?? "unknown"}`,
    `Message: ${snapshot.message}`,
    "",
    "Context:",
    context || "none",
    "",
    "Recent actions:",
    history || "none",
    ...(snapshot.stack ? ["", "Stack:", snapshot.stack] : []),
  ].join("\n");
};
