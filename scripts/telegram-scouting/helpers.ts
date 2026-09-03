import { createHash } from "node:crypto";

import { classifyContractCategory } from "../../src/entities/category";
import scoutingLinguisticData from "./linguistic-data.json";

import type {
  ChannelDescriptionContact,
  ChannelLanguage,
  Classification,
  FavorDryRunPayload,
  NormalizedChannelConfig,
  ParsedTelegramPost,
  ScoutingContact,
  ScoutingContactType,
  ScoutedPost,
  TelegramContact,
  TelegramContactSource,
  TelegramLink,
  TelegramScoutingInput,
} from "./types";

const compileLinguisticPattern = (
  name: keyof typeof scoutingLinguisticData.patterns,
): RegExp => {
  const pattern = scoutingLinguisticData.patterns[name];
  return new RegExp(pattern.source, pattern.flags);
};

const TELEGRAM_USERNAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;
const TELEGRAM_SERVICE_PATH_SEGMENTS = new Set([
  "addlist",
  "addstickers",
  "addemoji",
  "boost",
  "confirmphone",
  "invoice",
  "joinchat",
  "login",
  "proxy",
  "setlanguage",
  "share",
  "socks",
]);
const PUBLIC_TELEGRAM_ASSET_PATH_SEGMENTS = new Set([
  "addemoji",
  "addstickers",
]);
const CONTACT_CTA_PATTERN = compileLinguisticPattern("contactCta");
const AD_CONTEXT_PATTERN = compileLinguisticPattern("advertisementContext");
const ADMIN_CONTEXT_PATTERN = compileLinguisticPattern("administratorContext");
const CONTACT_BUTTON_PATTERN = compileLinguisticPattern("contactButton");
const CONTACT_LABEL_LINE_PATTERN = compileLinguisticPattern("contactLabelLine");
const CONTACT_SECTION_HEADER_PATTERN = compileLinguisticPattern("contactSectionHeader");
const CONTACT_SECTION_DETAIL_LINE_PATTERN = compileLinguisticPattern(
  "contactSectionDetailLine",
);
const CONTACT_ONLY_LINE_PATTERN =
  /^[\s✉📩📨📧📝☎📞👤💬➡️👉_*~`()[\]{}:;,.!?+\-/]*@[A-Za-z][A-Za-z0-9_]{4,31}[\s✉📩📨📧📝☎📞👤💬➡️👉_*~`()[\]{}:;,.!?+\-/]*$/u;
const NON_AUTHOR_NAVIGATION_PATTERN = compileLinguisticPattern(
  "nonAuthorNavigation",
);
const SEPARATOR_ONLY_LINE_PATTERN = /^(?:[=➖—–_-]\s*){3,}$/u;
const NON_AUTHOR_FOOTER_LINE_PATTERN = compileLinguisticPattern(
  "nonAuthorFooterLine",
);
const ISOLATED_CHANNEL_NAVIGATION_LINE_PATTERN = compileLinguisticPattern(
  "isolatedChannelNavigationLine",
);
const TRAILING_CONTACT_HEADING_PATTERN = compileLinguisticPattern(
  "trailingContactHeading",
);
const APPLICATION_SECTION_HEADER_PATTERN = compileLinguisticPattern(
  "applicationSectionHeader",
);
const APPLICATION_MEDIUM_CTA_LINE_PATTERN = compileLinguisticPattern(
  "applicationMediumCtaLine",
);
const REACTION_FOOTER_LINE_PATTERN = compileLinguisticPattern(
  "reactionFooterLine",
);
const REACTION_RESPONSE_LINE_PATTERN = compileLinguisticPattern(
  "reactionResponseLine",
);
const APPLICATION_URL_CONTEXT_PATTERN = compileLinguisticPattern(
  "applicationUrlContext",
);
const PUBLIC_BARE_HANDLE_PATTERN =
  /(?:^|[^A-Za-z0-9._%+-])@[A-Za-z][A-Za-z0-9_]{1,31}\b/u;
const PUBLIC_INTERNATIONAL_PHONE_PATTERN =
  /(?<![\p{L}\p{N}])\+(?:[ \t().-]*\d){10,15}(?![\p{L}\p{N}])/u;
const NON_TELEGRAM_SOCIAL_CONTEXT_PATTERN = compileLinguisticPattern(
  "nonTelegramSocialContext",
);
const PHONE_CONTEXT_PATTERN = compileLinguisticPattern("phoneContext");
const NON_PHONE_NUMBER_CONTEXT_PATTERN = compileLinguisticPattern(
  "nonPhoneNumberContext",
);

type ClassificationSignal = {
  pattern: RegExp;
  label: string;
  weight: number;
  decisive?: boolean;
};

const ACTUAL_ORDER_REQUEST_PATTERN = compileLinguisticPattern(
  "actualOrderRequest",
);
const ORDER_REQUEST_PATTERN = compileLinguisticPattern("orderRequest");
const ORDER_STRUCTURE_PATTERN = compileLinguisticPattern("orderStructure");
const EXPLICIT_RESUME_OFFER_PATTERN = compileLinguisticPattern(
  "explicitResumeOffer",
);

const ORDER_SIGNALS: ClassificationSignal[] = [
  {
    pattern: ORDER_REQUEST_PATTERN,
    label: scoutingLinguisticData.labels.orderSearchSpecialist,
    weight: 4,
    decisive: true,
  },
  {
    pattern: ORDER_STRUCTURE_PATTERN,
    label: scoutingLinguisticData.labels.orderVacancyStructure,
    weight: 4,
    decisive: true,
  },
  {
    pattern: compileLinguisticPattern("orderRequirementsSignal"),
    label: scoutingLinguisticData.labels.orderCandidateRequirements,
    weight: 2,
  },
  {
    pattern: compileLinguisticPattern("orderConditionsSignal"),
    label: scoutingLinguisticData.labels.orderWorkConditions,
    weight: 2,
  },
  {
    pattern: /(?:hiring|looking\s+for|we\s+need|vacancy|job\s+opening)/iu,
    label: "hiring",
    weight: 4,
    decisive: true,
  },
];

const OFFER_SIGNALS: ClassificationSignal[] = [
  {
    pattern: EXPLICIT_RESUME_OFFER_PATTERN,
    label: scoutingLinguisticData.labels.offerExplicitResumeMarker,
    weight: 4,
    decisive: true,
  },
  {
    pattern: compileLinguisticPattern("explicitWorkOfferSignal"),
    label: scoutingLinguisticData.labels.offerExplicitWorkSearch,
    weight: 4,
    decisive: true,
  },
  {
    pattern: compileLinguisticPattern("openToProjectsOfferSignal"),
    label: scoutingLinguisticData.labels.offerOpenToProjects,
    weight: 4,
    decisive: true,
  },
  {
    pattern: compileLinguisticPattern("selfPresentationOfferSignal"),
    label: scoutingLinguisticData.labels.offerSelfPresentation,
    weight: 4,
    decisive: true,
  },
  {
    pattern: compileLinguisticPattern("firstPersonReadyOfferSignal"),
    label: scoutingLinguisticData.labels.offerFirstPersonReady,
    weight: 4,
    decisive: true,
  },
  {
    pattern: /(?:available\s+for\s+(?:work|projects)|i\s+(?:offer|can\s+help)|freelancer\s+available)/iu,
    label: "freelancer offer",
    weight: 4,
    decisive: true,
  },
];

const PROMOTIONAL_CONTENT_PATTERN = compileLinguisticPattern("promotionalContent");
const NON_LABOR_OR_SUSPICIOUS_PATTERN = compileLinguisticPattern(
  "nonLaborOrSuspicious",
);
const RESTRICTED_OR_HIGH_RISK_PATTERN = compileLinguisticPattern(
  "restrictedOrHighRisk",
);
const TIME_SENSITIVE_LISTING_PATTERN = compileLinguisticPattern(
  "timeSensitiveListing",
);
const AUDIT_MANUAL_REVIEW_PATTERN = compileLinguisticPattern("auditManualReview");
const GENERIC_CONTENT_MANAGER_TEMPLATE_PATTERN = compileLinguisticPattern(
  "genericContentManagerTemplate",
);
const CONTENT_INTEGRITY_MANUAL_REVIEW_PATTERN = compileLinguisticPattern(
  "contentIntegrityManualReview",
);
const SEMANTIC_TITLE_MISMATCH_MANUAL_REVIEW_PATTERN = compileLinguisticPattern(
  "semanticTitleMismatchManualReview",
);
const MALFORMED_SOURCE_TITLE_PATTERN = compileLinguisticPattern(
  "malformedSourceTitle",
);

const normalizeText = (value: string) =>
  value
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const parseDateBoundary = (value: string, endOfDay: boolean): Date => {
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`
    : value;
  const date = new Date(normalized);
  if (!Number.isFinite(date.getTime())) throw new Error(`Invalid date: ${value}`);
  return date;
};

export const resolveDateWindow = (input: {
  from?: string;
  to?: string;
  days?: number;
  now?: Date;
}): { from: Date; to: Date } => {
  if (input.days !== undefined && (input.from !== undefined || input.to !== undefined)) {
    throw new Error("Use either --days or --from/--to, not both.");
  }
  const now = input.now ? new Date(input.now) : new Date();
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid current date.");
  const days = input.days ?? 30;
  if (!Number.isInteger(days) || days < 1 || days > 3660) {
    throw new Error("--days must be an integer from 1 to 3660.");
  }

  const to = input.to ? parseDateBoundary(input.to, true) : now;
  const from = input.from
    ? parseDateBoundary(input.from, false)
    : new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  if (from.getTime() > to.getTime()) throw new Error("--from must not be after --to.");
  return { from, to };
};

export const normalizeTelegramUsername = (value: string): string | null => {
  const trimmed = value
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(?:www\.)?(?:t|telegram)\.me\//i, "")
    .split(/[/?#]/, 1)[0];

  const normalized = trimmed.toLowerCase();
  if (
    !TELEGRAM_USERNAME_PATTERN.test(trimmed) ||
    TELEGRAM_SERVICE_PATH_SEGMENTS.has(normalized)
  ) {
    return null;
  }
  return normalized;
};

export const normalizeChannelHandle = (value: string): string => {
  const withoutScheme = value
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(?:www\.)?(?:t|telegram)\.me\//i, "")
    .replace(/^s\//i, "");
  const handle = withoutScheme.split(/[/?#]/, 1)[0];
  const normalized = normalizeTelegramUsername(handle);

  if (!normalized) {
    throw new Error(`Invalid public Telegram channel handle: ${value}`);
  }

  return normalized;
};

const normalizeUsernameList = (values: string[]) =>
  Array.from(
    new Set(
      values
        .map(normalizeTelegramUsername)
        .filter((value): value is string => value !== null),
    ),
  ).sort();

const normalizeEmail = (value: string): string | null => {
  const candidate = value.trim().replace(/^mailto:/i, "").split("?", 1)[0].toLowerCase();
  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(
    candidate,
  )
    ? candidate
    : null;
};

const normalizePhone = (value: string): string | null => {
  const candidate = value.trim().replace(/^tel:/i, "");
  if (!/^\+?[\d \t().-]+$/u.test(candidate)) return null;
  const digits = candidate.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  const hasInternationalPrefix = candidate.startsWith("+");
  if (hasInternationalPrefix && digits.startsWith("7") && digits.length !== 11) {
    return null;
  }
  return `${hasInternationalPrefix ? "+" : ""}${digits}`;
};

const normalizeExternalUrl = (value: string): string | null => {
  const candidate = value.trim().replace(/[),.;:!?]+$/u, "");
  if (!candidate || /^(?:mailto|tel|tg):/i.test(candidate)) return null;
  const withScheme = /^(?:https?:)?\/\//i.test(candidate)
    ? candidate.startsWith("//")
      ? `https:${candidate}`
      : candidate
    : /^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:[/?#].*)?$/i.test(candidate)
      ? `https://${candidate}`
      : null;
  if (!withScheme) return null;

  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (/^(?:www\.)?(?:t|telegram)\.me$/i.test(url.hostname)) return null;
    url.hostname = url.hostname.toLowerCase();
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
};

const isApplicationUrl = (value: string, context = "") => {
  if (APPLICATION_URL_CONTEXT_PATTERN.test(context)) return true;
  try {
    const url = new URL(value);
    return /(?:^|\/)(?:vacanc(?:y|ies)|jobs?|careers?|apply)(?:\/|$)/iu.test(
      url.pathname,
    );
  } catch {
    return false;
  }
};

const hasNonAssetTelegramUrl = (value: string) => {
  const pattern =
    /(?:https?:\/\/)?(?:www\.)?(?:t|telegram)\.me\/([^\s<>{}\[\]()]+)/giu;
  for (const match of value.matchAll(pattern)) {
    const firstPathSegment = match[1]
      .replace(/[),.;:!?]+$/u, "")
      .split(/[/?#]/u, 1)[0]
      .toLowerCase();
    if (!PUBLIC_TELEGRAM_ASSET_PATH_SEGMENTS.has(firstPathSegment)) return true;
  }
  return false;
};

export const normalizeContactIdentity = (
  rawValue: string,
): Pick<ScoutingContact, "type" | "value" | "username"> | null => {
  const value = rawValue.trim();
  const explicitTelegram =
    value.startsWith("@") ||
    /^(?:https?:\/\/(?:www\.)?(?:t|telegram)\.me\/|tg:\/\/resolve\?)/i.test(value);
  if (explicitTelegram) {
    const username =
      extractTelegramUsernameFromUrl(value) ?? normalizeTelegramUsername(value);
    return username
      ? { type: "telegram", value: username, username }
      : null;
  }

  const email = normalizeEmail(value);
  if (email) return { type: "email", value: email, username: null };
  const phone = normalizePhone(value);
  if (phone) return { type: "phone", value: phone, username: null };
  const url = normalizeExternalUrl(value);
  if (url) return { type: "url", value: url, username: null };
  const username = normalizeTelegramUsername(value);
  return username ? { type: "telegram", value: username, username } : null;
};

const contactKey = (
  contact: Pick<ScoutingContact, "type" | "value">,
) => `${contact.type}:${contact.value}`;

const isAutomatedTelegramContact = (
  contact: Pick<ScoutingContact, "type" | "value" | "username">,
) =>
  contact.type === "telegram" &&
  /bot$/iu.test(contact.username ?? contact.value);

const normalizeContactList = (values: string[]) =>
  Array.from(
    new Map(
      values
        .map(normalizeContactIdentity)
        .filter(
          (
            contact,
          ): contact is Pick<ScoutingContact, "type" | "value" | "username"> =>
            contact !== null,
        )
        .map((contact) => [contactKey(contact), contact.value]),
    ).values(),
  ).sort();

export const parseScoutingInput = (value: unknown): {
  channels: NormalizedChannelConfig[];
  maxPagesPerChannel: number;
  requestDelayMs: number;
} => {
  if (!Array.isArray(value) && (typeof value !== "object" || value === null)) {
    throw new Error("Input must be a channel array or an object with a channels array.");
  }

  const input = value as TelegramScoutingInput;
  const channelsInput = Array.isArray(input) ? input : input.channels;
  const globalExclusions = Array.isArray(input)
    ? []
    : normalizeStringArray(input.excludedContacts, "excludedContacts");

  if (!Array.isArray(channelsInput) || channelsInput.length === 0) {
    throw new Error("Input must contain at least one Telegram channel.");
  }

  const channels = channelsInput.map((channel, index) => {
    const object = typeof channel === "string" ? { handle: channel } : channel;
    if (typeof object !== "object" || object === null) {
      throw new Error(`Channel at index ${index} must be a string or object.`);
    }

    const source = object.handle ?? object.url;
    if (!source) throw new Error(`Channel at index ${index} has no handle or url.`);

    const handle = normalizeChannelHandle(source);
    const adminContacts = normalizeContactList(
      normalizeStringArray(object.adminContacts, `channels[${index}].adminContacts`),
    );
    const advertisingContacts = normalizeContactList(
      normalizeStringArray(
        object.advertisingContacts,
        `channels[${index}].advertisingContacts`,
      ),
    );
    const explicitExclusions = normalizeStringArray(
      object.excludedContacts,
      `channels[${index}].excludedContacts`,
    );
    const language = object.language ?? "auto";
    if (language !== "auto" && language !== "ru" && language !== "en") {
      throw new Error(`Unsupported language for channel @${handle}: ${language}`);
    }

    return {
      handle,
      url: `https://t.me/${handle}`,
      topic: normalizeOptionalString(object.topic),
      category: normalizeOptionalString(object.category),
      language,
      configuredAdminContacts: adminContacts,
      configuredAdvertisingContacts: advertisingContacts,
      excludedContacts: normalizeContactList([
        `@${handle}`,
        ...globalExclusions,
        ...explicitExclusions,
        ...adminContacts,
        ...advertisingContacts,
      ]),
    } satisfies NormalizedChannelConfig;
  });

  const uniqueChannels = new Map<string, NormalizedChannelConfig>();
  for (const channel of channels) {
    if (uniqueChannels.has(channel.handle)) {
      throw new Error(`Duplicate Telegram channel in input: @${channel.handle}`);
    }
    uniqueChannels.set(channel.handle, channel);
  }

  return {
    channels: [...uniqueChannels.values()],
    maxPagesPerChannel: readBoundedInteger(
      Array.isArray(input) ? undefined : input.maxPagesPerChannel,
      50,
      1,
      200,
      "maxPagesPerChannel",
    ),
    requestDelayMs: readBoundedInteger(
      Array.isArray(input) ? undefined : input.requestDelayMs,
      350,
      0,
      10_000,
      "requestDelayMs",
    ),
  };
};

const normalizeStringArray = (value: unknown, field: string): string[] => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${field} must be an array of strings.`);
  }
  return value;
};

const normalizeOptionalString = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new Error("Channel metadata must be text.");
  return value.trim() || null;
};

const readBoundedInteger = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
  field: string,
) => {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) {
    throw new Error(`${field} must be an integer from ${min} to ${max}.`);
  }
  return Number(value);
};

const collectRegexUsernames = (value: string): string[] => {
  const found: string[] = [];
  const mentionPattern = /(?:^|[^A-Za-z0-9._%+-])@([A-Za-z][A-Za-z0-9_]{4,31})\b/g;
  const linkPattern =
    /(?:https?:\/\/(?:www\.)?(?:t|telegram)\.me\/)([A-Za-z][A-Za-z0-9_]{4,31})\b/gi;
  const resolvePattern = /tg:\/\/resolve\?[^\s]*?domain=([A-Za-z][A-Za-z0-9_]{4,31})\b/gi;

  for (const match of value.matchAll(mentionPattern)) found.push(match[1]);
  for (const match of value.matchAll(linkPattern)) found.push(match[1]);
  for (const match of value.matchAll(resolvePattern)) found.push(match[1]);

  return normalizeUsernameList(found);
};

export const extractTelegramUsernameFromUrl = (value: string): string | null => {
  const decoded = value.replace(/&amp;/g, "&");
  const resolveMatch = decoded.match(/[?&]domain=([A-Za-z][A-Za-z0-9_]{4,31})\b/i);
  if (/^tg:\/\/resolve\?/i.test(decoded) && resolveMatch) {
    return normalizeTelegramUsername(resolveMatch[1]);
  }

  try {
    const url = new URL(decoded, "https://t.me/");
    if (!/^(?:www\.)?(?:t|telegram)\.me$/i.test(url.hostname)) return null;
    const segment = url.pathname.replace(/^\/s\//, "/").split("/").filter(Boolean)[0];
    return segment ? normalizeTelegramUsername(segment) : null;
  } catch {
    return null;
  }
};

export const extractTelegramContacts = (input: {
  text: string;
  inlineLinks: TelegramLink[];
  buttons: TelegramLink[];
}, options: { allowAdministrativeContexts?: boolean } = {}): TelegramContact[] => {
  const contacts = new Map<
    string,
    { sources: Set<TelegramContactSource>; evidence: Set<string> }
  >();

  const add = (username: string | null, source: TelegramContactSource, evidence: string) => {
    if (!username) return;
    const current = contacts.get(username) ?? {
      sources: new Set<TelegramContactSource>(),
      evidence: new Set<string>(),
    };
    current.sources.add(source);
    current.evidence.add(evidence.trim().slice(0, 240));
    contacts.set(username, current);
  };

  const nonTelegramLinkedHandles = new Set(
    input.inlineLinks
      .filter((link) => extractTelegramUsernameFromUrl(link.url) === null)
      .map((link) => link.text.trim().match(/^@([A-Za-z][A-Za-z0-9_]{4,31})$/u)?.[1])
      .filter((username): username is string => typeof username === "string")
      .map((username) => username.toLowerCase()),
  );

  for (const username of collectRegexUsernames(input.text)) {
    if (nonTelegramLinkedHandles.has(username)) continue;
    const details = getUsernameContextDetails(input.text, username).find((candidate) =>
      isAuthorContactContext(
        candidate.line,
        candidate.context,
        options.allowAdministrativeContexts,
      ),
    );
    if (!details) continue;
    const context = details.context;
    add(username, "text", context || `@${username}`);
  }

  for (const [source, links] of [
    ["inline_link", input.inlineLinks],
    ["button", input.buttons],
  ] as const) {
    for (const link of links) {
      if (NON_AUTHOR_NAVIGATION_PATTERN.test(link.text)) continue;
      const username = extractTelegramUsernameFromUrl(link.url);
      if (!username) continue;
      const details = getTextContextDetails(input.text, link.text);
      const hasExplicitContactLabel = CONTACT_BUTTON_PATTERN.test(link.text);
      if (
        (source === "button" && !hasExplicitContactLabel) ||
        (source === "inline_link" &&
          !hasExplicitContactLabel &&
          (!details ||
            !isAuthorContactContext(
              details.line,
              details.context,
              options.allowAdministrativeContexts,
            )))
      ) {
        continue;
      }
      add(
        username,
        source,
        details?.context && details.context.trim() !== link.text.trim()
          ? details.context
          : `${link.text || "Telegram link"}: ${link.url}`,
      );
    }
  }

  return [...contacts.entries()]
    .map(([username, details]) => ({
      type: "telegram" as const,
      value: username,
      username,
      sources: [...details.sources].sort(),
      evidence: [...details.evidence],
    }))
    .sort(
      (left, right) =>
        contactEvidenceScore(right) - contactEvidenceScore(left) ||
        left.value.localeCompare(right.value),
    );
};

const getTextContextDetails = (
  text: string,
  needle: string,
): { line: string; context: string } | null => {
  const normalizedNeedle = needle.trim().toLowerCase();
  if (!normalizedNeedle) return null;
  const lines = text.split("\n");
  const index = lines.findIndex((line) => line.toLowerCase().includes(normalizedNeedle));
  if (index < 0) return null;
  const line = lines[index].trim();
  const previous = index > 0 ? lines[index - 1].trim() : "";
  return {
    line,
    context: [previous, line].filter(Boolean).join("\n"),
  };
};

const getUsernameContextDetails = (
  text: string,
  username: string,
): Array<{ line: string; context: string }> => {
  const lines = text.split("\n");
  const pattern = new RegExp(
    `(?:@|(?:t|telegram)\\.me/)${escapeRegExp(username)}\\b`,
    "i",
  );
  return lines.flatMap((value, index) => {
    if (!pattern.test(value)) return [];
    const line = value.trim();
    const previous = index > 0 ? lines[index - 1].trim() : "";
    return [
      {
        line,
        context: [previous, line].filter(Boolean).join("\n"),
      },
    ];
  });
};

const isAuthorContactContext = (
  line: string,
  context: string,
  allowAdministrativeContexts = false,
) => {
  if (
    NON_AUTHOR_NAVIGATION_PATTERN.test(context) ||
    NON_TELEGRAM_SOCIAL_CONTEXT_PATTERN.test(context)
  ) {
    return false;
  }
  return (
    CONTACT_CTA_PATTERN.test(context) ||
    CONTACT_ONLY_LINE_PATTERN.test(line) ||
    (allowAdministrativeContexts &&
      (AD_CONTEXT_PATTERN.test(context) || ADMIN_CONTEXT_PATTERN.test(context)))
  );
};

const contactEvidenceScore = (
  contact: Pick<ScoutingContact, "sources" | "evidence">,
) => {
  const evidence = contact.evidence.join("\n");
  let score = CONTACT_CTA_PATTERN.test(evidence) ? 4 : 0;
  if (compileLinguisticPattern("strongContactEvidence").test(evidence)) {
    score += 3;
  }
  if (contact.sources.includes("button")) score += 2;
  if (contact.sources.includes("inline_link")) score += 1;
  return score;
};

export const classifyChannelDescriptionContacts = (
  description: string,
  inlineLinks: TelegramLink[] = [],
): ChannelDescriptionContact[] =>
  extractScoutingContacts(
    { text: description, inlineLinks, buttons: [] },
    { includeAllUrls: true, allowAdministrativeTelegram: true },
  ).map((contact) => {
    const context = contact.evidence[0] ?? contact.value;
    const kind = AD_CONTEXT_PATTERN.test(context)
      ? "advertising"
      : ADMIN_CONTEXT_PATTERN.test(context)
        ? "admin"
        : "other";
    return {
      type: contact.type,
      value: contact.value,
      username: contact.username,
      kind,
      context,
    };
  });

const getValueContext = (text: string, value: string) => {
  const comparable = value.replace(/^https?:\/\//i, "").replace(/\/$/u, "").toLowerCase();
  return (
    text
      .split("\n")
      .find((line) => line.toLowerCase().includes(comparable))
      ?.trim() ?? ""
  );
};

const getPhoneContext = (text: string, phone: string) => {
  const digits = phone.replace(/\D/g, "");
  return (
    text
      .split("\n")
      .find((line) => line.replace(/\D/g, "").includes(digits))
      ?.trim() ?? ""
  );
};

const collectEmailValues = (text: string) =>
  Array.from(
    new Set(
      [...text.matchAll(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)+/gi)]
        .map((match) => normalizeEmail(match[0]))
        .filter((value): value is string => value !== null),
    ),
  );

const collectPhoneValues = (text: string) => {
  const masked = text
    .replace(/https?:\/\/[^\s<>{}\[\]]+/giu, (match) => " ".repeat(match.length))
    .replace(
      /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)+/giu,
      (match) => " ".repeat(match.length),
    );
  const phonePattern =
    /(?<![\p{L}\p{N}])(?:\+[ \t]*7(?:[ \t().-]*\d){10}|\+(?:[ \t().-]*\d){10,15}|(?:\d[ \t().-]*){9,14}\d)(?![\p{L}\p{N}])/gu;
  const values = new Set<string>();

  for (const line of masked.split("\n")) {
    const hasPhoneContext = PHONE_CONTEXT_PATTERN.test(line);
    const hasNonPhoneNumberContext = NON_PHONE_NUMBER_CONTEXT_PATTERN.test(line);
    for (const match of line.matchAll(phonePattern)) {
      const rawCandidate = match[0];
      const hasInternationalPrefix = rawCandidate.trimStart().startsWith("+");
      if (!hasInternationalPrefix && (!hasPhoneContext || hasNonPhoneNumberContext)) {
        continue;
      }
      if (hasInternationalPrefix && hasNonPhoneNumberContext && !hasPhoneContext) {
        continue;
      }
      const normalized = normalizePhone(rawCandidate);
      if (normalized) values.add(normalized);
    }
  }

  return [...values];
};

const collectExternalUrlValues = (text: string) => {
  const emailMasked = text.replace(
    /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)+/gi,
    (match) => " ".repeat(match.length),
  );
  const candidates = [
    ...emailMasked.matchAll(/https?:\/\/[^\s<>{}\[\]]+/gi),
    ...emailMasked.matchAll(
      /(?:^|[\s(])((?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s<>{}\[\]]*)?)/gim,
    ),
  ];
  return Array.from(
    new Set(
      candidates
        .map((match) => normalizeExternalUrl(match[1] ?? match[0]))
        .filter((value): value is string => value !== null),
    ),
  );
};

export const extractScoutingContacts = (
  input: {
    text: string;
    inlineLinks: TelegramLink[];
    buttons: TelegramLink[];
  },
  options: {
    includeAllUrls?: boolean;
    allowAdministrativeTelegram?: boolean;
  } = {},
): ScoutingContact[] => {
  const contacts = new Map<string, ScoutingContact>();
  const add = (
    identity: Pick<ScoutingContact, "type" | "value" | "username"> | null,
    source: TelegramContactSource,
    evidence: string,
  ) => {
    if (!identity) return;
    const key = contactKey(identity);
    const current = contacts.get(key) ?? {
      ...identity,
      sources: [],
      evidence: [],
    };
    if (!current.sources.includes(source)) current.sources.push(source);
    const normalizedEvidence = evidence.trim().slice(0, 240);
    if (normalizedEvidence && !current.evidence.includes(normalizedEvidence)) {
      current.evidence.push(normalizedEvidence);
    }
    contacts.set(key, current);
  };

  for (const contact of extractTelegramContacts(input, {
    allowAdministrativeContexts: options.allowAdministrativeTelegram,
  })) {
    contacts.set(contactKey(contact), contact);
  }
  for (const email of collectEmailValues(input.text)) {
    add(
      { type: "email", value: email, username: null },
      "text",
      getValueContext(input.text, email) || email,
    );
  }
  for (const phone of collectPhoneValues(input.text)) {
    add(
      { type: "phone", value: phone, username: null },
      "text",
      getPhoneContext(input.text, phone) || phone,
    );
  }
  for (const url of collectExternalUrlValues(input.text)) {
    const context = getValueContext(input.text, url);
    if (
      options.includeAllUrls ||
      CONTACT_CTA_PATTERN.test(context) ||
      AD_CONTEXT_PATTERN.test(context) ||
      isApplicationUrl(url, context)
    ) {
      add({ type: "url", value: url, username: null }, "text", context || url);
    }
  }

  for (const [source, links] of [
    ["inline_link", input.inlineLinks],
    ["button", input.buttons],
  ] as const) {
    for (const link of links) {
      const identity = normalizeContactIdentity(link.url);
      if (!identity || identity.type === "telegram") continue;
      const linkContext = link.text ? getValueContext(input.text, link.text) : "";
      if (
        identity.type === "url" &&
        !options.includeAllUrls &&
        !CONTACT_BUTTON_PATTERN.test(link.text) &&
        !isApplicationUrl(identity.value, `${link.text}\n${linkContext}`)
      ) {
        continue;
      }
      add(
        identity,
        source,
        linkContext || `${link.text || identity.value}: ${link.url}`,
      );
    }
  }

  const priority: Record<ScoutingContactType, number> = {
    telegram: 0,
    email: 1,
    phone: 2,
    url: 3,
  };
  return [...contacts.values()].sort(
    (left, right) =>
      priority[left.type] - priority[right.type] ||
      contactEvidenceScore(right) - contactEvidenceScore(left) ||
      left.value.localeCompare(right.value),
  );
};

export const sanitizeContractText = (
  rawText: string,
  options: {
    contacts?: ScoutingContact[];
    contactAnchorTexts?: string[];
  } = {},
): string => {
  const normalized = normalizeText(rawText);
  if (!normalized) return "";

  const contactValues = new Set((options.contacts ?? []).map((contact) => contact.value));
  const anchorTexts = (options.contactAnchorTexts ?? [])
    .map((value) => normalizeText(value).toLowerCase())
    .filter((value) => value.length >= 2);
  const lines = normalized.split("\n");
  const remove = new Set<number>();

  const lineHasKnownContact = (line: string) => {
    if (
      PUBLIC_BARE_HANDLE_PATTERN.test(line) ||
      PUBLIC_INTERNATIONAL_PHONE_PATTERN.test(line) ||
      hasNonAssetTelegramUrl(line)
    ) {
      return true;
    }
    const extracted = extractScoutingContacts({
      text: line,
      inlineLinks: [],
      buttons: [],
    });
    if (extracted.length > 0) return true;
    const lower = line.toLowerCase();
    return (
      [...contactValues].some((value) => lower.includes(value.toLowerCase())) ||
      anchorTexts.some((text) => lower === text || lower.includes(text))
    );
  };

  for (let index = 0; index < lines.length; index += 1) {
    if (CONTACT_SECTION_HEADER_PATTERN.test(lines[index])) {
      remove.add(index);
      for (let next = index + 1; next <= Math.min(lines.length - 1, index + 5); next += 1) {
        if (!lines[next]) continue;
        if (
          !CONTACT_SECTION_DETAIL_LINE_PATTERN.test(lines[next]) &&
          !lineHasKnownContact(lines[next])
        ) {
          break;
        }
        remove.add(next);
      }
      continue;
    }
    if (
      NON_AUTHOR_FOOTER_LINE_PATTERN.test(lines[index]) ||
      ISOLATED_CHANNEL_NAVIGATION_LINE_PATTERN.test(lines[index])
    ) {
      remove.add(index);
      continue;
    }
    if (REACTION_FOOTER_LINE_PATTERN.test(lines[index])) {
      remove.add(index);
      for (let next = index + 1; next <= Math.min(lines.length - 1, index + 4); next += 1) {
        if (!lines[next]) continue;
        if (!REACTION_RESPONSE_LINE_PATTERN.test(lines[next])) break;
        remove.add(next);
      }
      continue;
    }
    if (
      !CONTACT_LABEL_LINE_PATTERN.test(lines[index]) &&
      !lineHasKnownContact(lines[index])
    ) {
      continue;
    }
    remove.add(index);

    for (let previous = index - 1; previous >= Math.max(0, index - 2); previous -= 1) {
      const line = lines[previous];
      if (!line) continue;
      if (
        CONTACT_CTA_PATTERN.test(line) ||
        compileLinguisticPattern("contactHeadingLine").test(line)
      ) {
        remove.add(previous);
        continue;
      }
      break;
    }
  }

  const minimumApplicationCtaIndex = Math.floor(lines.length * 0.4);
  const applicationSectionStartIndex = lines.findIndex(
    (line, index) =>
      APPLICATION_SECTION_HEADER_PATTERN.test(line) ||
      (!remove.has(index) &&
        index >= minimumApplicationCtaIndex &&
        APPLICATION_MEDIUM_CTA_LINE_PATTERN.test(line)),
  );
  if (applicationSectionStartIndex >= 0) {
    for (let index = applicationSectionStartIndex; index < lines.length; index += 1) {
      remove.add(index);
    }
  }

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (
      remove.has(index) ||
      !lines[index] ||
      SEPARATOR_ONLY_LINE_PATTERN.test(lines[index])
    ) {
      continue;
    }
    if (TRAILING_CONTACT_HEADING_PATTERN.test(lines[index])) {
      remove.add(index);
    }
    break;
  }

  return lines
    .filter(
      (line, index) =>
        !remove.has(index) && !SEPARATOR_ONLY_LINE_PATTERN.test(line),
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 5000)
    .trim();
};

export const classifyContractText = (text: string): Classification => {
  let orderScore = 0;
  let offerScore = 0;
  let hasDecisiveOrderSignal = false;
  let hasDecisiveOfferSignal = false;
  const evidence: string[] = [];

  for (const signal of ORDER_SIGNALS) {
    if (!signal.pattern.test(text)) continue;
    orderScore += signal.weight;
    hasDecisiveOrderSignal ||= signal.decisive === true;
    evidence.push(`order: ${signal.label}`);
  }
  for (const signal of OFFER_SIGNALS) {
    if (!signal.pattern.test(text)) continue;
    offerScore += signal.weight;
    hasDecisiveOfferSignal ||= signal.decisive === true;
    evidence.push(`offer: ${signal.label}`);
  }

  const hasExplicitResumeOfferMarker = EXPLICIT_RESUME_OFFER_PATTERN.test(text);
  const isPromotionWithoutWorkRequest =
    PROMOTIONAL_CONTENT_PATTERN.test(text) &&
    !ACTUAL_ORDER_REQUEST_PATTERN.test(text) &&
    !ORDER_STRUCTURE_PATTERN.test(text) &&
    !hasDecisiveOfferSignal;
  const bestScore = Math.max(orderScore, offerScore);
  const difference = Math.abs(orderScore - offerScore);
  let type: Classification["type"] = "unknown";
  if (isPromotionWithoutWorkRequest) {
    evidence.push(scoutingLinguisticData.evidence.promotionWithoutWorkRequest);
  } else if (
    hasExplicitResumeOfferMarker ||
    (hasDecisiveOfferSignal &&
      offerScore >= 4 &&
      (!hasDecisiveOrderSignal || offerScore > orderScore))
  ) {
    type = "offer";
  } else if (
    (hasDecisiveOrderSignal || orderScore >= 4) &&
    (!hasDecisiveOfferSignal || orderScore >= offerScore)
  ) {
    type = "order";
  }
  const confidence = hasExplicitResumeOfferMarker
    ? "high"
    : type === "unknown" || bestScore < 3
      ? "low"
      : difference >= 3 && bestScore >= 4
        ? "high"
        : "medium";

  return { type, confidence, orderScore, offerScore, evidence };
};

export const normalizeContentForDedupe = (value: string) =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/https?:\/\/\S+/gu, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

export const fingerprintContent = (value: string) =>
  createHash("sha256").update(normalizeContentForDedupe(value)).digest("hex");

const GENERIC_TITLE_PATTERN = compileLinguisticPattern("genericTitle");
const TITLE_METADATA_TOKEN_PATTERN = compileLinguisticPattern(
  "titleMetadataToken",
);
const HASHTAG_ONLY_TITLE_PATTERN =
  /^\s*(?:#[\p{L}\p{N}_-]+[\s,|/·•]*)+$/u;
const ROLE_TITLE_PATTERN = compileLinguisticPattern("roleTitle");
const GENERIC_ROLE_TITLE_PATTERN = compileLinguisticPattern("genericRoleTitle");

const normalizeTitleCandidate = (value: string) =>
  value
    .replace(compileLinguisticPattern("leadingLocationMetadata"), "")
    .replace(/^[^\p{L}\p{N}#@]+/u, "")
    .replace(/^[\s>*_`~#()[\]{}-]+/u, "")
    .replace(/#/gu, "")
    .replace(/_+/gu, " ")
    .replace(compileLinguisticPattern("mixedScriptContent"), "Content")
    .replace(compileLinguisticPattern("mixedScriptSmm"), "SMM")
    .replace(
      compileLinguisticPattern("repeatedPreposition"),
      "$1",
    )
    .replace(/(?<=\p{Ll})\s*\/\s*|\s*\/\s*(?=\p{Ll})/gu, " / ")
    .replace(/\s*\|\s*/gu, " | ")
    .replace(/(?<=[\p{L}\p{N}])-\s+(?=\p{Ll})/gu, "-")
    .replace(/\s+/gu, " ")
    .replace(/[.!?]+$/u, "")
    .trim();

const isUsableContractTitle = (value: string) => {
  if (HASHTAG_ONLY_TITLE_PATTERN.test(value)) return false;
  const candidate = normalizeTitleCandidate(value);
  if (candidate.length < 12 || candidate.length > 90) return false;
  if (
    GENERIC_TITLE_PATTERN.test(candidate) ||
    /(?:…|\.\.\.)$/u.test(candidate) ||
    /(?:https?:|www\.|(?:^|\s)\/\s*(?:jobs?|vacanc\p{L}*))/iu.test(candidate)
  ) {
    return false;
  }
  const tokens = candidate
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  if (tokens.length === 0 || tokens.every((token) => TITLE_METADATA_TOKEN_PATTERN.test(token))) {
    return false;
  }
  return /\p{L}/u.test(candidate) && ROLE_TITLE_PATTERN.test(candidate);
};

const findSpecificRoleTitle = (lines: string[], genericTitle: string) => {
  const detailsIndex = lines.findIndex((line) =>
    compileLinguisticPattern("detailsHeading").test(line),
  );
  if (detailsIndex < 0) return null;

  for (
    let index = detailsIndex + 1;
    index <= Math.min(lines.length - 1, detailsIndex + 8);
    index += 1
  ) {
    if (HASHTAG_ONLY_TITLE_PATTERN.test(lines[index])) continue;
    const candidate = normalizeTitleCandidate(lines[index]).replace(
      compileLinguisticPattern("trailingWorkModeMetadata"),
      "",
    );
    if (
      candidate.length < genericTitle.length + 8 ||
      compileLinguisticPattern("genericRolePrefix").test(candidate) ||
      !isUsableContractTitle(candidate)
    ) {
      continue;
    }
    return candidate;
  }
  return null;
};

const deriveTitle = (text: string, inlineLinks: TelegramLink[]) => {
  const lines = text.split("\n");
  const firstLine = lines.find((line) => line.trim().length > 0) ?? "";
  if (isUsableContractTitle(firstLine)) {
    const normalized = normalizeTitleCandidate(firstLine);
    return GENERIC_ROLE_TITLE_PATTERN.test(normalized)
      ? findSpecificRoleTitle(lines, normalized) ?? normalized
      : normalized;
  }

  const roleLine = lines.find((line) =>
    compileLinguisticPattern("roleLine").test(line),
  );
  if (roleLine && isUsableContractTitle(roleLine)) {
    const normalized = normalizeTitleCandidate(roleLine);
    return GENERIC_ROLE_TITLE_PATTERN.test(normalized)
      ? findSpecificRoleTitle(lines, normalized) ?? normalized
      : normalized;
  }

  const linkedTitle = inlineLinks.find((link) => {
    if (!normalizeExternalUrl(link.url)) return false;
    if (
      CONTACT_BUTTON_PATTERN.test(link.text) ||
      NON_AUTHOR_NAVIGATION_PATTERN.test(link.text)
    ) {
      return false;
    }
    return isUsableContractTitle(link.text);
  })?.text;
  return linkedTitle ? normalizeTitleCandidate(linkedTitle) : null;
};

const isMultiListingDigest = (text: string) => {
  const numberedListingLines = text.match(/^\s*\d{1,2}[.)]\s+\S+/gmu)?.length ?? 0;
  return (
    numberedListingLines >= 2 ||
    compileLinguisticPattern("multiListingPluralRoles").test(text) ||
    compileLinguisticPattern("multiListingCountedRoles").test(text) ||
    compileLinguisticPattern("multiListingAdditionalRole").test(text)
  );
};

const isIncompleteContractText = (text: string) =>
  compileLinguisticPattern("incompleteContractEnding").test(text);

const CONTRACT_DETAIL_MIN_CODE_POINTS = 200;
const CONTRACT_DETAIL_MIN_TOKENS = 30;
const CONCRETE_SCOPE_PATTERN = compileLinguisticPattern("concreteScope");
const FIRST_PERSON_SCOPE_PATTERN = compileLinguisticPattern("firstPersonScope");

const hasSufficientContractDetail = (text: string) => {
  const codePointCount = [...text.trim()].length;
  const tokenCount = text.match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
  return (
    codePointCount >= CONTRACT_DETAIL_MIN_CODE_POINTS ||
    tokenCount >= CONTRACT_DETAIL_MIN_TOKENS ||
    CONCRETE_SCOPE_PATTERN.test(text) ||
    FIRST_PERSON_SCOPE_PATTERN.test(text)
  );
};

const extractHashtags = (text: string) =>
  Array.from(
    new Set(
      [...text.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]{1,30})/gu)].map((match) =>
        match[1].toLowerCase(),
      ),
    ),
  ).slice(0, 10);

const resolveLanguage = (text: string, configured: ChannelLanguage): "ru" | "en" => {
  if (configured !== "auto") return configured;
  return compileLinguisticPattern("russianLetter").test(text) ? "ru" : "en";
};

export const buildFavorDryRunPayload = (input: {
  source: ParsedTelegramPost;
  cleanedText: string;
  selectedUsername: string;
  classification: Classification;
  channel: NormalizedChannelConfig;
}): FavorDryRunPayload | null => {
  if (input.classification.type === "unknown") return null;
  const title = deriveTitle(input.cleanedText, input.source.inlineLinks);
  if (!title || !hasSufficientContractDetail(input.cleanedText)) return null;
  const language = resolveLanguage(input.cleanedText, input.channel.language);
  const category = classifyContractCategory({
    titleRu: language === "ru" ? title : null,
    titleEn: language === "en" ? title : null,
    descriptionRu: language === "ru" ? input.cleanedText : null,
    descriptionEn: language === "en" ? input.cleanedText : null,
    tags: extractHashtags(input.cleanedText),
  });

  return {
    titleRu: language === "ru" ? title : null,
    titleEn: language === "en" ? title : null,
    descriptionRu: language === "ru" ? input.cleanedText : null,
    descriptionEn: language === "en" ? input.cleanedText : null,
    type: input.classification.type,
    category: category.categoryId,
    tags: extractHashtags(input.cleanedText),
    // Salary, revenue, trial-task, and per-item amounts cannot be mapped safely to
    // Favor's contract price without human context.
    basePrice: null,
    deadlineDays: null,
    maxOpenDeals: input.classification.type === "order" ? 1 : 3,
    telegramPostUrl: input.source.postUrl,
    telegramChannelUrl: input.source.channelUrl,
    cachedTelegramText: input.cleanedText,
    mediaRefs: [],
    isScouting: true,
    scoutedTelegramUsername: input.selectedUsername,
    isEscrow: false,
    escrowCurrency: "TON",
  };
};

export const normalizeScoutedPost = (
  post: ParsedTelegramPost,
  channel: NormalizedChannelConfig,
  extraExcludedContacts: string[] = [],
): ScoutedPost => {
  const excludedSet = new Set(
    [...channel.excludedContacts, ...extraExcludedContacts]
      .map(normalizeContactIdentity)
      .filter(
        (
          contact,
        ): contact is Pick<ScoutingContact, "type" | "value" | "username"> =>
          contact !== null,
      )
      .map(contactKey),
  );
  const direct = post.contacts.filter(
    (contact) =>
      !excludedSet.has(contactKey(contact)) &&
      !isAutomatedTelegramContact(contact),
  );
  const excluded = post.contacts.filter(
    (contact) =>
      excludedSet.has(contactKey(contact)) || isAutomatedTelegramContact(contact),
  );
  const extractedContactKeys = new Set(post.contacts.map(contactKey));
  const contactAnchorTexts = [...post.inlineLinks, ...post.buttons]
    .filter((link) => {
      if (NON_AUTHOR_NAVIGATION_PATTERN.test(link.text)) return true;
      const identity = normalizeContactIdentity(link.url);
      return (
        identity !== null &&
        (extractedContactKeys.has(contactKey(identity)) ||
          CONTACT_BUTTON_PATTERN.test(link.text))
      );
    })
    .map((link) => link.text);
  const cleanedText = sanitizeContractText(post.rawText, {
    contacts: post.contacts,
    contactAnchorTexts,
  });
  const classification = classifyContractText(cleanedText);
  const selected = direct[0] ?? null;
  const selectedUsername =
    direct.find((contact) => contact.type === "telegram")?.username ?? null;
  const reviewReasons: string[] = [];

  if (!post.rawText.trim()) reviewReasons.push("empty_source_text");
  if (!cleanedText) reviewReasons.push("empty_after_contact_sanitization");
  if (cleanedText.length > 0 && cleanedText.length < 20) {
    reviewReasons.push("public_text_too_short");
  }
  if (!selected) reviewReasons.push("no_direct_author_contact");
  if (classification.type === "unknown") reviewReasons.push("contract_type_unknown");
  if (NON_LABOR_OR_SUSPICIOUS_PATTERN.test(post.rawText)) {
    reviewReasons.push("non_labor_or_suspicious_listing");
  }

  const manualPayloadReasons: string[] = [];
  if (cleanedText.length >= 20 && !hasSufficientContractDetail(cleanedText)) {
    manualPayloadReasons.push("insufficient_contract_detail_manual_review");
  }
  if (!deriveTitle(cleanedText, post.inlineLinks)) {
    manualPayloadReasons.push("title_requires_manual_review");
  }
  if (MALFORMED_SOURCE_TITLE_PATTERN.test(post.rawText)) {
    manualPayloadReasons.push("malformed_title_manual_review");
  }
  if (isMultiListingDigest(cleanedText)) {
    manualPayloadReasons.push("multi_listing_digest_manual_review");
  }
  if (
    RESTRICTED_OR_HIGH_RISK_PATTERN.test(post.rawText) ||
    AUDIT_MANUAL_REVIEW_PATTERN.test(post.rawText) ||
    GENERIC_CONTENT_MANAGER_TEMPLATE_PATTERN.test(post.rawText) ||
    CONTENT_INTEGRITY_MANUAL_REVIEW_PATTERN.test(post.rawText) ||
    SEMANTIC_TITLE_MISMATCH_MANUAL_REVIEW_PATTERN.test(post.rawText)
  ) {
    manualPayloadReasons.push("manual_review_restricted_or_high_risk");
  }
  if (TIME_SENSITIVE_LISTING_PATTERN.test(post.rawText)) {
    manualPayloadReasons.push("time_sensitive_listing_manual_review");
  }
  if (isIncompleteContractText(cleanedText)) {
    manualPayloadReasons.push("incomplete_contract_text_manual_review");
  }

  const payload =
    selectedUsername && reviewReasons.length === 0 && manualPayloadReasons.length === 0
    ? buildFavorDryRunPayload({
        source: post,
        cleanedText,
        selectedUsername,
        classification,
        channel,
      })
    : null;
  const favorPayloadReasons: string[] = [];
  if (reviewReasons.length > 0) {
    favorPayloadReasons.push("review_not_eligible");
  } else {
    if (!selectedUsername) {
      favorPayloadReasons.push("telegram_contact_required_manual_review");
    }
    favorPayloadReasons.push(...manualPayloadReasons);
    if (selectedUsername && manualPayloadReasons.length === 0 && !payload) {
      favorPayloadReasons.push("favor_payload_invalid");
    }
  }
  const reviewEligible = reviewReasons.length === 0;
  const favorPayloadReady = payload !== null && favorPayloadReasons.length === 0;

  return {
    source: {
      channelHandle: post.channelHandle,
      channelUrl: post.channelUrl,
      postId: post.postId,
      postUrl: post.postUrl,
      publishedAt: post.publishedAt,
      rawText: post.rawText,
      inlineLinks: post.inlineLinks,
      buttons: post.buttons,
    },
    contacts: { direct, excluded, selected, selectedUsername },
    cleaned: {
      publicText: cleanedText,
      cachedTelegramText: cleanedText,
      contentFingerprint: fingerprintContent(cleanedText),
    },
    classification,
    eligibility: {
      eligible: reviewEligible,
      reasons: reviewReasons,
      reviewEligible,
      reviewReasons,
      favorPayloadReady,
      favorPayloadReasons,
    },
    favorDryRunPayload: payload,
  };
};

export const dedupeScoutedPosts = (posts: ScoutedPost[]): ScoutedPost[] => {
  const semanticRepresentatives: Array<{
    post: ScoutedPost;
    tokens: Set<string>;
  }> = [];
  for (const post of posts) {
    const tokens = semanticContentTokens(post.cleaned.publicText);
    const postContactKeys = new Set(post.contacts.direct.map(contactKey));
    const duplicateIndex = semanticRepresentatives.findIndex((candidate) => {
      if (
        candidate.post.cleaned.contentFingerprint === post.cleaned.contentFingerprint ||
        candidate.post.contacts.direct.some((contact) =>
          postContactKeys.has(contactKey(contact)),
        )
      ) {
        return false;
      }
      return semanticJaccard(tokens, candidate.tokens) >= 0.9;
    });
    if (duplicateIndex < 0) {
      semanticRepresentatives.push({ post, tokens });
      continue;
    }

    const current = semanticRepresentatives[duplicateIndex].post;
    if (preferSemanticRepresentative(post, current) === post) {
      semanticRepresentatives[duplicateIndex] = { post, tokens };
    }
  }

  const sortedByDeduplicationPriority = semanticRepresentatives
    .map(({ post }) => post)
    .sort((left, right) => {
      const safetyDifference = semanticSafetyScore(right) - semanticSafetyScore(left);
      if (safetyDifference !== 0) return safetyDifference;
      const dateDifference =
        Date.parse(right.source.publishedAt) - Date.parse(left.source.publishedAt);
      if (dateDifference !== 0) return dateDifference;
      return right.source.postId - left.source.postId;
    });
  const contactIdentities = new Set<string>();
  const sourceUrls = new Set<string>();
  const contents = new Set<string>();

  return sortedByDeduplicationPriority
    .filter((post) => {
      const postContacts = post.contacts.direct.map(contactKey);
      const duplicate =
        sourceUrls.has(post.source.postUrl) ||
        contents.has(post.cleaned.contentFingerprint) ||
        postContacts.some((contact) => contactIdentities.has(contact));
      if (duplicate) return false;

      sourceUrls.add(post.source.postUrl);
      contents.add(post.cleaned.contentFingerprint);
      for (const contact of postContacts) contactIdentities.add(contact);
      return true;
    })
    .sort((left, right) => {
      const dateDifference =
        Date.parse(right.source.publishedAt) - Date.parse(left.source.publishedAt);
      if (dateDifference !== 0) return dateDifference;
      return right.source.postId - left.source.postId;
    });
};

const semanticContentTokens = (value: string) => {
  const withoutAggregatorWrapper = value
    .replace(/^\s*(?:#[\p{L}\p{N}_-]+[\s,|/·•]*)+$/gmu, "")
    .replace(compileLinguisticPattern("semanticWrapperRoleLine"), "")
    .replace(compileLinguisticPattern("semanticWrapperDetailsHeading"), "")
    .replace(/^\s*[=➖—–_-]{5,}\s*$/gmu, "");
  return new Set(
    normalizeContentForDedupe(withoutAggregatorWrapper)
      .split(" ")
      .filter((token) => token.length >= 2),
  );
};

const semanticJaccard = (left: Set<string>, right: Set<string>) => {
  if (left.size < 30 || right.size < 30) return 0;
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }
  return intersection / (left.size + right.size - intersection);
};

const semanticSafetyScore = (post: ScoutedPost) =>
  (post.eligibility.reviewEligible ? 4 : 0) +
  (post.eligibility.favorPayloadReady ? 2 : 0) +
  (post.contacts.selectedUsername ? 1 : 0);

const preferSemanticRepresentative = (left: ScoutedPost, right: ScoutedPost) => {
  const scoreDifference = semanticSafetyScore(left) - semanticSafetyScore(right);
  if (scoreDifference !== 0) return scoreDifference > 0 ? left : right;
  const dateDifference =
    Date.parse(left.source.publishedAt) - Date.parse(right.source.publishedAt);
  if (dateDifference !== 0) return dateDifference < 0 ? left : right;
  return left.source.postId <= right.source.postId ? left : right;
};

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
