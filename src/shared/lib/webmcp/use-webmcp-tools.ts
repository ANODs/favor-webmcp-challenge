"use client";

import { useEffect, useMemo, useRef } from "react";

import { registerWebMcpTools } from "./runtime";
import type {
  UseWebMcpToolsOptions,
  WebMcpToolDefinition,
} from "./types";

const getRegistrationKey = (
  tools: readonly WebMcpToolDefinition[],
  exposedTo: readonly string[] | undefined,
  enabled: boolean | undefined,
) =>
  JSON.stringify({
    tools: tools.map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations,
    })),
    exposedTo,
    enabled,
  });

export const useWebMcpTools = (
  tools: readonly WebMcpToolDefinition[],
  options: UseWebMcpToolsOptions = {},
) => {
  const toolsRef = useRef(tools);
  const optionsRef = useRef(options);
  const registrationKey = useMemo(
    () => getRegistrationKey(tools, options.exposedTo, options.enabled),
    [tools, options.enabled, options.exposedTo],
  );

  useEffect(() => {
    toolsRef.current = tools;
    optionsRef.current = options;
  }, [options, tools]);

  useEffect(() => {
    if (optionsRef.current.enabled === false) return;

    const currentTools = toolsRef.current;
    const proxiedTools = currentTools.map((tool) => ({
      ...tool,
      execute: (
        input: Parameters<WebMcpToolDefinition["execute"]>[0],
        executeOptions: Parameters<WebMcpToolDefinition["execute"]>[1],
      ) => {
        const currentTool = toolsRef.current.find(
          (candidate) => candidate.name === tool.name,
        );
        return (currentTool ?? tool).execute(input, executeOptions);
      },
    }));
    const registration = registerWebMcpTools(proxiedTools, {
      exposedTo: optionsRef.current.exposedTo,
      onRegistrationError: (error, registeredTool) => {
        optionsRef.current.onRegistrationError?.(error, registeredTool);
      },
    });

    void registration.ready.catch(() => undefined);
    return registration.unregister;
  }, [registrationKey]);
};
