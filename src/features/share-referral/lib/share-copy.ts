import englishCopyJson from "./share-copy.en.json";
import russianCopyJson from "./share-copy.ru.json";

export type ReferralShareLocale = "ru" | "en";

type ReferralShareCopy = {
  [Key in keyof typeof englishCopyJson]: string;
};

const copyByLocale = {
  en: englishCopyJson,
  ru: russianCopyJson,
} satisfies Record<ReferralShareLocale, ReferralShareCopy>;

export const getReferralShareCopy = (locale: ReferralShareLocale) =>
  copyByLocale[locale];

export const getReferralShareIntlLocale = (locale: ReferralShareLocale) =>
  locale === "en" ? "en-US" : "ru-RU";

export const formatReferralReward = (
  locale: ReferralShareLocale,
  percent: string,
) => getReferralShareCopy(locale).reward.replace("{percent}", percent);

export const formatReferralPreparedDescription = (
  locale: ReferralShareLocale,
  usersCount: string,
  activeContractsCount: string,
) =>
  getReferralShareCopy(locale).preparedDescription
    .replace("{usersCount}", usersCount)
    .replace("{activeContractsCount}", activeContractsCount);
