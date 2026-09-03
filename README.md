# Favor

Favor turns the work people already discuss in Telegram into structured service offers, client requests, deals, optional on-chain escrow, and portable reputation.

- Live app: [favor.deals](https://favor.deals/en)
- Telegram app: [@FavorDealsBot](https://t.me/FavorDealsBot?startapp=feed)

## WebMCP Challenge extension

Favor now exposes its real marketplace and Telegram contract workflow to browser agents through the WebMCP Imperative API. The integration is mounted across the application and progressively registers four tools when `document.modelContext` is available:

| Tool | What people and agents can do together |
| --- | --- |
| `favor_search_contracts` | Find public service offers or client requests by text, category, budget, deadline, rating, and escrow support. |
| `favor_get_contract` | Inspect the selected listing, its terms, author reputation, reviews, and Favor URL. |
| `favor_read_telegram_post` | Read a public Telegram work post through Favor's existing import pipeline and return its text and media metadata. |
| `favor_prepare_contract_draft` | Turn the result into a 24-hour reviewable Telegram draft without publishing it or moving funds. |

The WebMCP layer reuses Favor's production APIs rather than duplicating product logic. Public marketplace reads are marked read-only, rate-limited, and bounded. Marketplace, review, and Telegram text is marked as untrusted content. Network requests accept the tool's cancellation signal, and the only state-changing tool stops at a visible human review step in Telegram.

The project existed before the challenge. The meaningful challenge-period extension is the WebMCP runtime, the four Favor tools, their application-level registration, tests, and this documentation. See [the implementation and demo guide](docs/webmcp-challenge.md).

## Run locally

Requirements: Node.js 20, pnpm, PostgreSQL, and a Telegram bot.

```bash
pnpm install
cp .env.example .env
pnpm prisma:generate
pnpm exec prisma migrate deploy
pnpm dev
```

Fill the required values in `.env` before starting. The app is then available at [http://localhost:3000/en](http://localhost:3000/en).

To use WebMCP, open the page in the ChatGPT in-app browser, or use a supported Chrome build with `chrome://flags/#enable-webmcp-testing` enabled.

## Verify

```bash
pnpm test:contracts
pnpm exec next typegen
pnpm exec tsc --noEmit --pretty false
pnpm build
```

The production image starts the Next.js server with `pnpm start`; `bot:start` runs the Telegram bot service.

## Licensing

Favor's challenge snapshot is released under the [MIT License](LICENSE). The vendored Mediabunny browser bundle keeps its original MPL-2.0 notice; see [Third-party notices](THIRD_PARTY_NOTICES.md).
