import assert from "node:assert/strict";
import test from "node:test";

import {
  isWebMcpSupported,
  registerWebMcpTools,
  type WebMcpToolDefinition,
  type WebMcpToolExecuteOptions,
  type WebMcpToolInput,
} from "../../src/shared/lib/webmcp";

type RegisteredTool = Omit<WebMcpToolDefinition, "execute"> & {
  execute: (
    input: WebMcpToolInput,
    options: WebMcpToolExecuteOptions,
  ) => Promise<unknown>;
};

const tool: WebMcpToolDefinition = {
  name: "search_contracts",
  title: "Search Favor contracts",
  description: "Search the public Favor contract feed.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string" },
    },
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true, untrustedContentHint: true },
  execute: ({ query }) => ({ query }),
};

test("WebMCP support detection is a safe progressive enhancement", async () => {
  const targetDocument = {} as Document;

  assert.equal(isWebMcpSupported(targetDocument), false);

  const registration = registerWebMcpTools([tool], { document: targetDocument });
  assert.equal(registration.supported, false);
  await registration.ready;
  assert.equal(registration.signal.aborted, false);

  registration.unregister();
  assert.equal(registration.signal.aborted, true);
});

test("WebMCP tools register through document.modelContext and abort together", async () => {
  const registrations: Array<{
    tool: RegisteredTool;
    options: { signal: AbortSignal; exposedTo?: string[] };
  }> = [];
  const targetDocument = {
    modelContext: {
      registerTool: async (
        registeredTool: RegisteredTool,
        options: { signal: AbortSignal; exposedTo?: string[] },
      ) => {
        registrations.push({ tool: registeredTool, options });
      },
    },
  } as unknown as Document;

  const registration = registerWebMcpTools([tool], {
    document: targetDocument,
    exposedTo: ["https://agent.example"],
  });
  await registration.ready;

  assert.equal(registration.supported, true);
  assert.equal(registrations.length, 1);
  assert.equal(registrations[0]?.tool.name, "search_contracts");
  assert.deepEqual(registrations[0]?.options.exposedTo, [
    "https://agent.example",
  ]);
  assert.equal(registrations[0]?.options.signal, registration.signal);
  assert.deepEqual(
    await registrations[0]?.tool.execute(
      { query: "designer" },
      { signal: new AbortController().signal },
    ),
    { query: "designer" },
  );

  registration.unregister();
  assert.equal(registration.signal.aborted, true);
});

test("a failed WebMCP registration reports the tool without removing other tools", async () => {
  const expectedError = new Error("registration denied");
  const reported: Array<{ error: unknown; name: string }> = [];
  const attempted: string[] = [];
  const healthyTool: WebMcpToolDefinition = {
    ...tool,
    name: "inspect_contract",
  };
  const targetDocument = {
    modelContext: {
      registerTool: async (registeredTool: RegisteredTool) => {
        attempted.push(registeredTool.name);
        if (registeredTool.name === tool.name) {
          throw expectedError;
        }
      },
    },
  } as unknown as Document;

  const registration = registerWebMcpTools([tool, healthyTool], {
    document: targetDocument,
    onRegistrationError: (error, registeredTool) => {
      reported.push({ error, name: registeredTool.name });
    },
  });

  await assert.rejects(registration.ready, expectedError);
  assert.deepEqual(attempted, ["search_contracts", "inspect_contract"]);
  assert.deepEqual(reported, [
    { error: expectedError, name: "search_contracts" },
  ]);
  assert.equal(registration.signal.aborted, false);

  registration.unregister();
  assert.equal(registration.signal.aborted, true);
});
