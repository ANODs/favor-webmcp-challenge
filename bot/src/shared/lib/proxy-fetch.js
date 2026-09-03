/* eslint-disable @typescript-eslint/no-require-imports */
const {
  Agent,
  FormData,
  ProxyAgent,
  fetch: undiciFetch,
} = require("undici");
const { env } = require("../config/env");

let proxyAgent = null;
let defaultAgent = null;

const TIMEOUTS = {
  connectTimeout: 60000,
  headersTimeout: 120000,
  bodyTimeout: 120000,
};

async function proxyFetch(input, init) {
  if (env.telegramProxyUrl) {
    if (!proxyAgent) {
      proxyAgent = new ProxyAgent({
        uri: env.telegramProxyUrl,
        ...TIMEOUTS,
      });
    }
    return undiciFetch(input, {
      ...init,
      dispatcher: proxyAgent,
    });
  }

  if (!defaultAgent) {
    defaultAgent = new Agent({
      ...TIMEOUTS,
    });
  }

  return undiciFetch(input, {
    ...init,
    dispatcher: defaultAgent,
  });
}

function createProxyFormData() {
  return new FormData();
}

module.exports = { createProxyFormData, proxyFetch };
