# Contract recommendations: implementation plan

Status: planned, not implemented.

## Goal

When a non-scout contract becomes active, recommend relevant contracts of the
opposite type in the same canonical category:

- a new `order` is matched with active `offer` contracts;
- a new `offer` is matched with active `order` contracts;
- both authors receive a concise Telegram recommendation with links to the
  matching Favor contracts;
- authors of already active opposite-side contracts may also receive the new
  contract, subject to opt-in, deduplication and rate limits.

The canonical category ID is the primary eligibility boundary. Localized
category labels are presentation only and never participate in matching.

## Activation event

The event is emitted only after a real status transition to `active`, not from
the contract creation endpoint, because newly created and edited contracts are
still awaiting moderation.

Initial producers:

- moderation approval: `pending_moderation -> active`;
- restoration/capacity transitions that genuinely reactivate a contract.

Repeated approval, retries and process restarts must not create duplicate
recommendations. Scout contracts (`scoutId IS NOT NULL`) are excluded until
they are claimed by their real author and deliberately reactivated.

## Ownership and boundaries

Create a server-only feature slice:

```text
src/features/contract-recommendations/
  model/rules.ts
  server/find-matches.ts
  server/create-deliveries.ts
  server/process-outbox.ts
  server.ts
```

The slice may depend on contract/category/user entities and shared Telegram
infrastructure. Route handlers and workers are composition boundaries. It must
not be embedded into contract notification code or imported by a sibling
feature.

## Persistence

### ContractMatch

- `id`
- `orderContractId`
- `offerContractId`
- `categoryId`
- `score`
- `reasons` (JSON)
- `createdAt`, `updatedAt`, `invalidatedAt`
- unique `(orderContractId, offerContractId)`

### ContractRecommendationDelivery

- `id`
- `matchId`
- `recipientUserId`
- `contractIdShown`
- `channel` (`telegram` initially)
- `status` (`pending`, `sending`, `sent`, `failed`, `suppressed`)
- `attempts`, `nextAttemptAt`, `sentAt`, `lastError`
- unique `(matchId, recipientUserId, contractIdShown, channel)`

### OutboxEvent

- `id`, `eventType`, `aggregateId`, `payload`
- `status`, `attempts`, `nextAttemptAt`, `processedAt`, `lastError`
- unique idempotency key for the contract activation/version

The activation status change and outbox insert happen in one database
transaction. Telegram calls never run inside the moderation HTTP request.

## Eligibility and ranking

Hard filters:

- both contracts are `active`;
- both are non-scout contracts;
- types are opposite;
- canonical category IDs are equal and not `other.manual`;
- authors differ;
- the candidate can still accept a deal (`maxOpenDeals`/open-deal capacity);
- neither contract nor account is blocked, archived or opted out;
- the pair has not already produced the same delivery.

Version 1 ranking remains deterministic:

1. same canonical category (required);
2. overlapping normalized tags;
3. compatible budget/deadline when both sides specify them;
4. freshness decay;
5. author reputation/completion signal as a bounded tie-breaker.

Return a small top-N set (recommended default: 3), with explicit reason codes.
Do not add embeddings or opaque AI scoring until category-level conversion and
false-positive rates are measured.

## Delivery policy

- Telegram recommendations are opt-in; settings include immediate, digest and
  disabled modes.
- A new author receives at most one grouped message containing the top matches.
- Existing opposite-side authors receive the new contract only when it enters
  their top-N and their cooldown allows it.
- Apply per-user daily caps, global throughput limits, exponential retry and
  Telegram `429 retry_after` handling.
- Group bursts into a digest to avoid one message per contract.
- Every message explains why it was sent and provides disable/digest controls.

## Recalculation and invalidation

Re-evaluate affected pairs when a contract is edited and re-approved, becomes
full, is archived, changes category/type, or is claimed from scouting. Existing
matches are invalidated, not deleted, so delivery history and idempotency remain
auditable.

## Observability and rollout

Track:

- candidates and matches per activation;
- delivery success, retry and suppression rates;
- click/open/initiation conversion;
- opt-out and complaint rates;
- matches by category and false-positive feedback.

Rollout:

1. shadow matching with no messages;
2. moderator-only inspection;
3. opt-in recommendations to the newly activated contract author;
4. limited opposite-side fan-out with strict daily caps;
5. digests and ranking refinement based on measured conversion.

The recommendation feature should not be enabled until all active contracts,
auctions and promotions use canonical category IDs.
