import { env } from "@/shared/config/env";

type UndiciRequestInit = RequestInit & {
  dispatcher?: unknown;
};

type UndiciModule = {
  FormData: new () => FormData;
  ProxyAgent: new (uri: string) => unknown;
  fetch: (input: RequestInfo | URL, init?: UndiciRequestInit) => Promise<Response>;
};

let agent: unknown = null;
let undiciModule: UndiciModule | null = null;

const getUndici = () => {
  if (!undiciModule) {
    // Keep the server-only dependency out of client bundles.
    undiciModule = eval("require")("undici") as UndiciModule;
  }

  return undiciModule;
};

export function createProxyFormData() {
  if (typeof window !== "undefined" || !env.telegramProxyUrl) {
    return new FormData();
  }

  const { FormData: UndiciFormData } = getUndici();
  return new UndiciFormData();
}

export async function proxyFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (typeof window === "undefined" && env.telegramProxyUrl) {
    const undici = getUndici();

    if (!agent) {
      agent = new undici.ProxyAgent(env.telegramProxyUrl);
    }

    return undici.fetch(input, {
      ...init,
      dispatcher: agent,
    });
  }

  return fetch(input, init);
}
