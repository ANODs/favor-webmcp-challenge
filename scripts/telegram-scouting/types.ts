export type ContractType = "order" | "offer";

export type ChannelLanguage = "ru" | "en" | "auto";

export type TelegramScoutingChannelInput =
  | string
  | {
      handle?: string;
      url?: string;
      topic?: string;
      category?: string;
      language?: ChannelLanguage;
      excludedContacts?: string[];
      adminContacts?: string[];
      advertisingContacts?: string[];
    };

export type TelegramScoutingInput =
  | TelegramScoutingChannelInput[]
  | {
      channels: TelegramScoutingChannelInput[];
      excludedContacts?: string[];
      maxPagesPerChannel?: number;
      requestDelayMs?: number;
    };

export type NormalizedChannelConfig = {
  handle: string;
  url: string;
  topic: string | null;
  category: string | null;
  language: ChannelLanguage;
  excludedContacts: string[];
  configuredAdminContacts: string[];
  configuredAdvertisingContacts: string[];
};

export type TelegramLink = {
  text: string;
  url: string;
};

export type TelegramPostSource = {
  channelHandle: string;
  channelUrl: string;
  postId: number;
  postUrl: string;
  publishedAt: string;
  rawText: string;
  inlineLinks: TelegramLink[];
  buttons: TelegramLink[];
};

export type TelegramContactSource = "text" | "inline_link" | "button";

export type ScoutingContactType = "telegram" | "email" | "phone" | "url";

export type ScoutingContact = {
  type: ScoutingContactType;
  value: string;
  username: string | null;
  sources: TelegramContactSource[];
  evidence: string[];
};

export type TelegramContact = ScoutingContact & {
  type: "telegram";
  username: string;
};

export type ParsedTelegramPost = TelegramPostSource & {
  contacts: ScoutingContact[];
};

export type ChannelDescriptionContactKind =
  | "advertising"
  | "admin"
  | "other";

export type ChannelDescriptionContact = {
  type: ScoutingContactType;
  value: string;
  username: string | null;
  kind: ChannelDescriptionContactKind;
  context: string;
};

export type ParsedTelegramChannelPage = {
  metadata: {
    handle: string;
    url: string;
    title: string | null;
    description: string | null;
    subscriberText: string | null;
    descriptionContacts: ChannelDescriptionContact[];
  };
  posts: ParsedTelegramPost[];
};

export type Classification = {
  type: ContractType | "unknown";
  confidence: "high" | "medium" | "low";
  orderScore: number;
  offerScore: number;
  evidence: string[];
};

export type FavorDryRunPayload = {
  titleRu: string | null;
  titleEn: string | null;
  descriptionRu: string | null;
  descriptionEn: string | null;
  type: ContractType;
  category: string | null;
  tags: string[];
  basePrice: number | null;
  deadlineDays: null;
  maxOpenDeals: number;
  telegramPostUrl: string;
  telegramChannelUrl: string;
  cachedTelegramText: string;
  mediaRefs: [];
  isScouting: true;
  scoutedTelegramUsername: string;
  isEscrow: false;
  escrowCurrency: "TON";
};

export type ScoutedPost = {
  source: TelegramPostSource;
  contacts: {
    direct: ScoutingContact[];
    excluded: ScoutingContact[];
    selected: ScoutingContact | null;
    selectedUsername: string | null;
  };
  cleaned: {
    publicText: string;
    cachedTelegramText: string;
    contentFingerprint: string;
  };
  classification: Classification;
  eligibility: {
    /** Backward-compatible alias for reviewEligible. */
    eligible: boolean;
    /** Backward-compatible alias for reviewReasons. */
    reasons: string[];
    reviewEligible: boolean;
    reviewReasons: string[];
    favorPayloadReady: boolean;
    favorPayloadReasons: string[];
  };
  favorDryRunPayload: FavorDryRunPayload | null;
};

export type ChannelCollectionResult = {
  handle: string;
  url: string;
  title: string | null;
  description: string | null;
  subscriberText: string | null;
  topic: string | null;
  category: string | null;
  language: ChannelLanguage;
  configuredExcludedContacts: string[];
  descriptionContacts: ChannelDescriptionContact[];
  outreachContacts: ChannelDescriptionContact[];
  fetchedPages: number;
  scrapedPostCount: number;
  error: string | null;
};

export type TelegramScoutingArtifact = {
  schemaVersion: 2;
  mode: "dry-run";
  generatedAt: string;
  window: {
    from: string;
    to: string;
  };
  summary: {
    channelCount: number;
    scrapedPostCount: number;
    deduplicatedPostCount: number;
    contactEligiblePostCount: number;
    discardedNoDirectContactPostCount: number;
    /** Backward-compatible alias for reviewEligiblePostCount. */
    eligiblePostCount: number;
    reviewEligiblePostCount: number;
    favorPayloadReadyPostCount: number;
    manualReviewOnlyPostCount: number;
  };
  channels: ChannelCollectionResult[];
  /** Contact-eligible rows only; no-contact audit rows are counted but omitted. */
  posts: ScoutedPost[];
};
