import englishCopyJson from "./share-copy.en.json";
import russianCopyJson from "./share-copy.ru.json";

export type ContractShareLocale = "ru" | "en";

type ContractShareCopy = {
  [Key in keyof typeof englishCopyJson]: string;
};

const copyByLocale = {
  en: englishCopyJson,
  ru: russianCopyJson,
} satisfies Record<ContractShareLocale, ContractShareCopy>;

export const getContractShareCopy = (locale: ContractShareLocale) =>
  copyByLocale[locale];

export const getContractShareIntlLocale = (locale: ContractShareLocale) =>
  locale === "en" ? "en-US" : "ru-RU";
