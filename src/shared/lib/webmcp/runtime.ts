import type {
  RegisterWebMcpToolsOptions,
  WebMcpRegistration,
  WebMcpToolDefinition,
  WebMcpToolExecuteOptions,
  WebMcpToolInput,
} from "./types";

type NativeWebMcpTool = Omit<WebMcpToolDefinition, "execute"> & {
  execute: (
    input: WebMcpToolInput,
    options?: Partial<WebMcpToolExecuteOptions>,
  ) => Promise<unknown>;
};

type NativeWebMcpModelContext = {
  registerTool: (
    tool: NativeWebMcpTool,
    options: {
      signal: AbortSignal;
      exposedTo?: string[];
    },
  ) => Promise<void>;
};

type WebMcpCapableDocument = Document & {
  modelContext?: NativeWebMcpModelContext;
};

const resolveDocument = (targetDocument?: Document | null) => {
  if (targetDocument !== undefined) return targetDocument;
  return typeof document === "undefined" ? null : document;
};

const getModelContext = (targetDocument?: Document | null) => {
  const resolvedDocument = resolveDocument(targetDocument);
  if (!resolvedDocument) return null;

  try {
    const modelContext = (resolvedDocument as WebMcpCapableDocument).modelContext;
    return modelContext && typeof modelContext.registerTool === "function"
      ? modelContext
      : null;
  } catch {
    return null;
  }
};

export const isWebMcpSupported = (targetDocument?: Document | null) =>
  getModelContext(targetDocument) !== null;

export const registerWebMcpTools = (
  tools: readonly WebMcpToolDefinition[],
  options: RegisterWebMcpToolsOptions = {},
): WebMcpRegistration => {
  const controller = new AbortController();
  const modelContext = getModelContext(options.document);

  if (!modelContext) {
    return {
      supported: false,
      signal: controller.signal,
      ready: Promise.resolve(),
      unregister: () => controller.abort(),
    };
  }

  const registrationOptions = {
    signal: controller.signal,
    ...(options.exposedTo
      ? { exposedTo: Array.from(options.exposedTo) }
      : {}),
  };

  const registrations = tools.map(async (tool) => {
    const { execute, ...definition } = tool;

    try {
      await modelContext.registerTool(
        {
          ...definition,
          execute: async (input, executeOptions) =>
            execute(input, {
              signal: executeOptions?.signal ?? controller.signal,
            }),
        },
        registrationOptions,
      );
    } catch (error) {
      if (controller.signal.aborted) return;
      options.onRegistrationError?.(error, tool);
      throw error;
    }
  });

  const ready = Promise.all(registrations).then(() => undefined);

  return {
    supported: true,
    signal: controller.signal,
    ready,
    unregister: () => controller.abort(),
  };
};
