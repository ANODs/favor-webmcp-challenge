import type {
  SubscriptionBenefit,
  SubscriptionBenefitId,
} from "../model/benefits.runtime.cjs";

export type SubscriptionGiftNotificationLocale = "en" | "ru";

export const SUBSCRIPTION_GIFT_VIDEO: Readonly<{
  id: "favor_plus_gift_video";
  mediaId: "favor_plus_gift_video";
  attachmentName: "favor_plus_gift_video_file";
  filename: "favor-plus-gift.mp4";
  contentType: "video/mp4";
  width: 720;
  height: 720;
  duration: 6;
  supportsStreaming: true;
  inputMedia: Readonly<{
    type: "video";
    media: "attach://favor_plus_gift_video_file";
    width: 720;
    height: 720;
    duration: 6;
    supports_streaming: true;
  }>;
}>;

export type SubscriptionGiftNotificationBenefit = SubscriptionBenefit & {
  id: SubscriptionBenefitId;
  label: string;
};

export type SubscriptionGiftNotification = {
  html: string;
  fallbackHtml: string;
  text: string;
  benefits: SubscriptionGiftNotificationBenefit[];
  buttons: Array<{
    text: string;
    url: string;
  }>;
};

export function buildSubscriptionGiftNotification(input: {
  locale?: string | null;
  payerName?: string | null;
  premiumExpiresAt?: Date | string | number | null;
  settingsUrl: string;
}): SubscriptionGiftNotification;
