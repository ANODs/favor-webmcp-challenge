# Telegram scouting collector

This local CLI reads public `t.me/s/<handle>` pages and produces a reviewable
JSON artifact. It never calls Favor APIs, creates contracts, or sends Telegram
messages.

> [!WARNING]
> Generated scouting JSON contains raw source text and private outreach
> contacts. Keep it local, do not commit it, and do not expose it through a
> public route or client bundle. The repository ignores
> `artifacts/telegram-scouting-*.json` by default.

The input may be a channel array or an object:

```json
{
  "channels": [
    {
      "handle": "public_channel_handle",
      "topic": "web development",
      "category": "Development",
      "language": "ru",
      "excludedContacts": [],
      "adminContacts": [],
      "advertisingContacts": []
    }
  ],
  "excludedContacts": [],
  "maxPagesPerChannel": 50,
  "requestDelayMs": 350
}
```

Channel, administrator, and advertising contacts are excluded from candidate
author contacts. Configuration accepts Telegram usernames, email addresses,
phone numbers, and URLs. All contacts detected in a channel description are
kept in `channels[].descriptionContacts`; advertising contacts are also copied
to `channels[].outreachContacts` for later manual review.

Run a rolling collection:

```text
pnpm scout:telegram -- --input ./channels.json --output ./artifacts/scouting.json --days 30
```

Or use an explicit inclusive range with `--from` and `--to`. The main `posts`
array contains only rows with a direct author/application contact. Each retained post
contains its raw public source text, contact-sanitized public/cached text,
review eligibility, Favor-payload readiness, and a `favorDryRunPayload` when it
can be constructed safely. Telegram, email, phone, and contact-form links make
a post reviewable. Automatic Favor payloads still require a Telegram username;
email/phone/URL-only rows are marked `telegram_contact_required_manual_review`.
No payload is submitted anywhere.

The optional channel `category` is collection metadata only. It is never copied
into a contract: each payload receives a canonical Favor category ID from its
own title and description (for example, `media.video_editing`). This prevents a
broad channel label from overriding the actual profession in an individual
post.

`summary` contains:

- `channelCount`
- `scrapedPostCount` (before global deduplication)
- `deduplicatedPostCount`
- `contactEligiblePostCount` (the number of rows retained in `posts`)
- `discardedNoDirectContactPostCount`
- `eligiblePostCount` (compatibility alias for `reviewEligiblePostCount`)
- `reviewEligiblePostCount`
- `favorPayloadReadyPostCount`
- `manualReviewOnlyPostCount`
