import englishCopyJson from "./share-copy.en.json";
import russianCopyJson from "./share-copy.ru.json";

export type ProfileShareLocale = "ru" | "en";

type ProfileShareCopy = {
  [Key in keyof typeof englishCopyJson]: string;
};

const copyByLocale = {
  en: englishCopyJson,
  ru: russianCopyJson,
} satisfies Record<ProfileShareLocale, ProfileShareCopy>;

export const getProfileShareCopy = (locale: ProfileShareLocale) =>
  copyByLocale[locale];

export const getProfileShareIntlLocale = (locale: ProfileShareLocale) =>
  locale === "en" ? "en-US" : "ru-RU";

export const formatProfilePreparedDescription = (
  locale: ProfileShareLocale,
  completedDealsCount: number,
  contractsCount: number,
) =>
  getProfileShareCopy(locale).preparedDescription
    .replace("{completedDealsCount}", String(completedDealsCount))
    .replace("{contractsCount}", String(contractsCount));
