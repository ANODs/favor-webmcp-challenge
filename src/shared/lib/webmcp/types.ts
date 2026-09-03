export type WebMcpToolInput = Record<string, unknown>;

export type WebMcpToolExecuteOptions = Readonly<{
  signal: AbortSignal;
}>;

export type WebMcpToolAnnotations = Readonly<{
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
}>;

export type WebMcpToolDefinition = Readonly<{
  name: string;
  title?: string;
  description: string;
  inputSchema?: Readonly<Record<string, unknown>>;
  annotations?: WebMcpToolAnnotations;
  execute: (
    input: WebMcpToolInput,
    options: WebMcpToolExecuteOptions,
  ) => unknown | Promise<unknown>;
}>;

export type WebMcpRegistrationErrorHandler = (
  error: unknown,
  tool: WebMcpToolDefinition,
) => void;

export type WebMcpRegistration = Readonly<{
  supported: boolean;
  signal: AbortSignal;
  ready: Promise<void>;
  unregister: () => void;
}>;

export type RegisterWebMcpToolsOptions = Readonly<{
  document?: Document | null;
  exposedTo?: readonly string[];
  onRegistrationError?: WebMcpRegistrationErrorHandler;
}>;

export type UseWebMcpToolsOptions = Readonly<{
  enabled?: boolean;
  exposedTo?: readonly string[];
  onRegistrationError?: WebMcpRegistrationErrorHandler;
}>;
