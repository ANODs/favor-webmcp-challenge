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
