import {
  dedupeScoutedPosts,
  normalizeContactIdentity,
  normalizeScoutedPost,
} from "./helpers";
import { parseTelegramChannelPage } from "./parser";
import type {
  ChannelCollectionResult,
  ChannelDescriptionContact,
  NormalizedChannelConfig,
  ParsedTelegramPost,
  TelegramScoutingArtifact,
} from "./types";

type CollectorOptions = {
  channels: NormalizedChannelConfig[];
  from: Date;
  to: Date;
  maxPagesPerChannel: number;
  requestDelayMs: number;
  fetcher?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  generatedAt?: Date;
};

type CollectedChannel = {
  metadata: ChannelCollectionResult;
  posts: ParsedTelegramPost[];
};

const defaultSleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const mergeDescriptionContacts = (
  parsed: ChannelDescriptionContact[],
  channel: NormalizedChannelConfig,
) => {
  const contacts = new Map<string, ChannelDescriptionContact>();
  for (const contact of parsed) contacts.set(`${contact.type}:${contact.value}`, contact);
  for (const configuredValue of channel.configuredAdminContacts) {
    const contact = normalizeContactIdentity(configuredValue);
    if (!contact) continue;
    const key = `${contact.type}:${contact.value}`;
    const existing = contacts.get(key);
    if (existing) {
      contacts.set(key, { ...existing, kind: "admin" });
    } else {
      contacts.set(key, {
        ...contact,
        kind: "admin",
        context: "Configured channel administrator contact",
      });
    }
  }
  for (const configuredValue of channel.configuredAdvertisingContacts) {
    const contact = normalizeContactIdentity(configuredValue);
    if (!contact) continue;
    const key = `${contact.type}:${contact.value}`;
    const existing = contacts.get(key);
    if (existing) {
      contacts.set(key, { ...existing, kind: "advertising" });
    } else {
      contacts.set(key, {
        ...contact,
        kind: "advertising",
        context: "Configured channel advertising contact",
      });
    }
  }
  return [...contacts.values()].sort((left, right) =>
    left.value.localeCompare(right.value),
  );
};

const collectChannel = async (
  channel: NormalizedChannelConfig,
  options: CollectorOptions,
): Promise<CollectedChannel> => {
  const fetcher = options.fetcher ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const postsByUrl = new Map<string, ParsedTelegramPost>();
  let cursor: number | null = null;
  let title: string | null = null;
  let description: string | null = null;
  let subscriberText: string | null = null;
  let parsedDescriptionContacts: ChannelDescriptionContact[] = [];
  let fetchedPages = 0;
  let collectionError: string | null = null;
  let reachedWindowStart = false;

  for (let page = 0; page < options.maxPagesPerChannel; page += 1) {
    const pageUrl = new URL(`https://t.me/s/${channel.handle}`);
    if (cursor !== null) pageUrl.searchParams.set("before", String(cursor));

    try {
      const response = await fetcher(pageUrl.toString(), {
        redirect: "follow",
        signal: AbortSignal.timeout(30_000),
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "ru,en;q=0.8",
          "User-Agent":
            "Mozilla/5.0 (compatible; FavorTelegramScouting/1.0; +https://favor.tg)",
        },
      });
      if (!response.ok) {
        throw new Error(`Telegram returned HTTP ${response.status} for @${channel.handle}`);
      }

      const parsed = parseTelegramChannelPage(await response.text(), channel.handle);
      fetchedPages += 1;
      title ??= parsed.metadata.title;
      description ??= parsed.metadata.description;
      subscriberText ??= parsed.metadata.subscriberText;
      if (parsed.metadata.descriptionContacts.length > 0) {
        parsedDescriptionContacts = parsed.metadata.descriptionContacts;
      }
      if (parsed.posts.length === 0) break;

      for (const post of parsed.posts) {
        const timestamp = Date.parse(post.publishedAt);
        if (timestamp >= options.from.getTime() && timestamp <= options.to.getTime()) {
          postsByUrl.set(post.postUrl, post);
        }
      }

      const oldestId = Math.min(...parsed.posts.map((post) => post.postId));
      const oldestTimestamp = Math.min(
        ...parsed.posts.map((post) => Date.parse(post.publishedAt)),
      );
      if (oldestTimestamp < options.from.getTime()) {
        reachedWindowStart = true;
        break;
      }
      if (cursor === oldestId) break;
      cursor = oldestId;
      if (options.requestDelayMs > 0 && page + 1 < options.maxPagesPerChannel) {
        await sleep(options.requestDelayMs);
      }
    } catch (error) {
      collectionError = errorMessage(error);
      break;
    }
  }

  if (
    !collectionError &&
    !reachedWindowStart &&
    cursor !== null &&
    fetchedPages >= options.maxPagesPerChannel
  ) {
    collectionError = "max_pages_reached_before_window_start";
  }

  const descriptionContacts = mergeDescriptionContacts(
    parsedDescriptionContacts,
    channel,
  );
  const outreachContacts = descriptionContacts.filter(
    (contact) => contact.kind === "advertising",
  );

  return {
    metadata: {
      handle: channel.handle,
      url: channel.url,
      title,
      description,
      subscriberText,
      topic: channel.topic,
      category: channel.category,
      language: channel.language,
      configuredExcludedContacts: channel.excludedContacts,
      descriptionContacts,
      outreachContacts,
      fetchedPages,
      scrapedPostCount: postsByUrl.size,
      error: collectionError,
    },
    posts: [...postsByUrl.values()],
  };
};

export const collectTelegramScouting = async (
  options: CollectorOptions,
): Promise<TelegramScoutingArtifact> => {
  if (!Number.isFinite(options.from.getTime()) || !Number.isFinite(options.to.getTime())) {
    throw new Error("The collection window contains an invalid date.");
  }
  if (options.from.getTime() > options.to.getTime()) {
    throw new Error("The collection window start must not be after its end.");
  }

  const collectedChannels: CollectedChannel[] = [];
  const sleep = options.sleep ?? defaultSleep;
  for (let index = 0; index < options.channels.length; index += 1) {
    const channel = options.channels[index];
    if (index > 0 && options.requestDelayMs > 0) {
      await sleep(options.requestDelayMs);
    }
    collectedChannels.push(await collectChannel(channel, options));
  }

  const channelByHandle = new Map(
    options.channels.map((channel) => [channel.handle, channel]),
  );
  const channelResultByHandle = new Map(
    collectedChannels.map((channel) => [channel.metadata.handle, channel]),
  );
  const normalizedPosts = collectedChannels.flatMap((result) => {
    const channel = channelByHandle.get(result.metadata.handle);
    if (!channel) return [];
    const channelContacts = channelResultByHandle
      .get(result.metadata.handle)
      ?.metadata.descriptionContacts
      .map((contact) => contact.value);
    return result.posts.map((post) =>
      normalizeScoutedPost(post, channel, channelContacts ?? []),
    );
  });
  const deduplicatedPosts = dedupeScoutedPosts(normalizedPosts);
  const posts = deduplicatedPosts.filter((post) => post.contacts.direct.length > 0);
  const reviewEligiblePostCount = posts.filter(
    (post) => post.eligibility.reviewEligible,
  ).length;
  const favorPayloadReadyPostCount = posts.filter(
    (post) => post.eligibility.favorPayloadReady,
  ).length;

  return {
    schemaVersion: 2,
    mode: "dry-run",
    generatedAt: (options.generatedAt ?? new Date()).toISOString(),
    window: {
      from: options.from.toISOString(),
      to: options.to.toISOString(),
    },
    summary: {
      channelCount: collectedChannels.length,
      scrapedPostCount: normalizedPosts.length,
      deduplicatedPostCount: deduplicatedPosts.length,
      contactEligiblePostCount: posts.length,
      discardedNoDirectContactPostCount: deduplicatedPosts.length - posts.length,
      eligiblePostCount: reviewEligiblePostCount,
      reviewEligiblePostCount,
      favorPayloadReadyPostCount,
      manualReviewOnlyPostCount:
        reviewEligiblePostCount - favorPayloadReadyPostCount,
    },
    channels: collectedChannels.map((channel) => channel.metadata),
    posts,
  };
};
