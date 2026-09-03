# Favor WebMCP integration

## Why WebMCP fits Favor

Finding work in Telegram is conversational and fragmented. A useful post may be in one channel, the matching specialist in another, and the agreement in a private chat. Before WebMCP, an agent could read the page visually but could not reliably understand Favor's contract types, filters, escrow terms, or Telegram import flow.

Favor now exposes those product capabilities as structured browser-native tools. A person can describe the outcome in ordinary language while the agent searches the live marketplace, compares trustworthy signals, imports an existing Telegram post, and prepares a contract draft. The person keeps control of the final publication and every financial action.

## Human and agent flow

Example prompt:

> Find a TikTok promotion specialist under $300 who supports escrow. Compare the best options, then turn my public Telegram brief into a client request that I can review in Telegram.

The agent can:

1. Call `favor_search_contracts` with the requested role, USD budget, and escrow filter.
2. Call `favor_get_contract` for the strongest candidates and compare terms, completed deals, rating, and reviews.
3. Call `favor_read_telegram_post` to import the person's existing brief and suggested bilingual copy.
4. Call `favor_prepare_contract_draft` to create an expiring Telegram handoff.
5. Ask the person to open the returned link, review every field, and publish manually if it is correct.

The last step is intentional. WebMCP assists with discovery and preparation, but it never silently publishes a contract, starts a deal, funds escrow, releases payment, or issues a refund.

## Implementation

The integration uses the imperative `document.modelContext.registerTool()` API.

- `src/shared/lib/webmcp/` owns capability detection, registration, cancellation, and React lifecycle cleanup.
- `src/app/providers/webmcp-tools.tsx` defines the Favor-specific schemas, annotations, concise outputs, and execution handlers.
- `src/app/providers/app-provider.tsx` mounts the tools once at the application composition boundary.
- Existing `contractsClient` and `contractPublicationDraftsClient` methods remain the single source of truth for Favor's HTTP contracts.
- `tests/contracts/webmcp-runtime.test.ts` verifies progressive enhancement, registration, execution, cleanup, and failed-registration handling.

The integration is a progressive enhancement. Browsers without WebMCP keep the existing Favor experience unchanged.

## Challenge-period scope and traceability

Favor was already a production marketplace before the challenge. This repository is a sanitized source snapshot of that product, not a newly created challenge-only application. The work claimed for the WebMCP Challenge is limited to the WebMCP integration and the production adapters needed to run it safely.

The exact source footprint is:

- Registration and tool definitions: `src/app/providers/app-provider.tsx`, `src/app/providers/webmcp-tools.tsx`.
- WebMCP runtime: `src/shared/lib/webmcp/index.ts`, `src/shared/lib/webmcp/runtime.ts`, `src/shared/lib/webmcp/types.ts`, `src/shared/lib/webmcp/use-webmcp-tools.ts`.
- Production API and client adapters: `src/app/api/contracts/route.ts`, `src/app/api/contracts/[slug]/route.ts`, `src/app/api/contracts/telegram-post-preview/route.ts`, `src/entities/contract/api/contracts-client.ts`, `src/features/create-contract/api/publication-drafts-client.ts`, `src/features/create-contract/index.ts`.
- Cancellation, input, and Telegram URL hardening: `src/features/create-contract/server/telegram-post-translation.ts`, `src/shared/api/base-client.ts`, `src/shared/config/client.ts`, `src/shared/config/contract.ts`, `src/shared/config/index.ts`, `src/entities/contract/model/schema.ts`, `src/shared/lib/telegram/client.ts`, `src/shared/lib/telegram/post.server.ts`, `src/shared/lib/telegram/post.ts`.
- Tests and documentation: `tests/contracts/webmcp-runtime.test.ts`, `tests/contracts/api-session-refresh.test.ts`, `tests/contracts/contract-price.test.ts`, `tests/contracts/telegram-post-url.test.ts`, `README.md`, and this file.

The production-source commit also contained an adjacent search-history feature. That feature, the pre-existing marketplace, Telegram Mini App, reputation system, deals, and escrow implementation are not claimed as challenge-period WebMCP work.

| History | Commit date (UTC+03:00) | Commit | Relevant change |
| --- | --- | --- | --- |
| Production source | 2026-09-03 04:47:31 | `be51ee47a7a447695131c112cb498f739b4e11d2` | Added the WebMCP runtime, four tools, production adapters, tests, and documentation. |
| Production source | 2026-09-03 05:09:28 | `b6fe799e5c736fa9c310d0801356c78c5dbcee9a` | Supported WebMCP clients that omit per-call execution options while retaining the registration cancellation signal. |
| Public snapshot | 2026-09-03 05:04:24 | [`07f426d655d8ac113882d939eed697f2e23a9390`](https://github.com/ANODs/favor-webmcp-challenge/commit/07f426d655d8ac113882d939eed697f2e23a9390) | Published the sanitized application snapshot, MIT license, WebMCP source, tests, and documentation. |
| Public snapshot | 2026-09-03 05:10:19 | [`94b3cd95986bdac87e5ba68e94a23b9945482347`](https://github.com/ANODs/favor-webmcp-challenge/commit/94b3cd95986bdac87e5ba68e94a23b9945482347) | Mirrored the execution-options compatibility fix. |
| Public snapshot | 2026-09-03 05:19:04 | [`59c4dc1b99074e0c644b104d863fc480f3ce7178`](https://github.com/ANODs/favor-webmcp-challenge/commit/59c4dc1b99074e0c644b104d863fc480f3ce7178) | Removed local build paths from generated contract artifacts. |

## Production verification

The following non-destructive checks were completed against [favor.deals](https://favor.deals/en) on 2026-09-03:

- The English site, time endpoint, category endpoint, and bounded public marketplace search returned HTTP 200.
- The deployed application registered all four `favor_*` tools in the ChatGPT in-app browser.
- `favor_search_contracts`, `favor_get_contract`, and `favor_read_telegram_post` executed successfully against live production data. Returned user-authored content is intentionally not copied into this repository.
- The Telegram Mini App launched from [@FavorDealsBot](https://t.me/FavorDealsBot?startapp=feed) and rendered the live product.
- No listing was published, no deal was started, and no escrow or payment action was performed during verification. `favor_prepare_contract_draft` was discovered but not invoked in the read-only production smoke test; its draft handoff is covered by the implementation and automated tests.

## Security and control

- Read-only tools declare `readOnlyHint: true`.
- Tools returning listings, reviews, or Telegram text declare `untrustedContentHint: true`.
- Inputs are strict JSON schemas and are validated again with Zod at execution time.
- Contract slugs are restricted to Favor's generated slug format and URL-encoded before requests.
- Tool descriptions, parameter descriptions, and outputs are deliberately compact.
- Tool cancellation is forwarded to the underlying network request.
- Public agent search is rate-limited and scans a bounded candidate set; draft links expire after 24 hours.
- Publication and all escrow actions require an explicit user-controlled flow outside the WebMCP tool.

## Demo checklist

1. Open [favor.deals/en](https://favor.deals/en) in the ChatGPT in-app browser or WebMCP-enabled Chrome.
2. Show the four registered `favor_*` tools.
3. Search the live marketplace and inspect one result.
4. Import a public Telegram post.
5. Prepare a draft and open its Telegram review link.
6. Stop before publication and explain the human approval boundary.

The submission video should show this working flow with audio and remain under three minutes.
