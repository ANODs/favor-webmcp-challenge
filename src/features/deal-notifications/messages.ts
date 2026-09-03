import type { DealDto } from "@/entities/deal";

import englishMessages from "./messages.en.json";
import russianMessages from "./messages.ru.json";

type DealNotificationCatalog = Omit<typeof englishMessages, "statuses"> & {
  statuses: Record<DealDto["status"], string>;
};

export type DealNotificationMessageKey = Exclude<
  keyof DealNotificationCatalog,
  "statuses"
>;

export const dealNotificationCatalogs = {
  en: englishMessages,
  ru: russianMessages,
} satisfies Record<"en" | "ru", DealNotificationCatalog>;

type DealNotificationLocale = keyof typeof dealNotificationCatalogs;

export const renderDealNotificationMessage = (
  locale: DealNotificationLocale,
  key: DealNotificationMessageKey,
  values: Record<string, string | number> = {},
) =>
  dealNotificationCatalogs[locale][key].replace(
    /\{([^{}]+)\}/g,
    (placeholder, name: string) =>
      Object.prototype.hasOwnProperty.call(values, name)
        ? String(values[name])
        : placeholder,
  );

export const getDealNotificationStatusLabel = (
  locale: DealNotificationLocale,
  status: DealDto["status"],
) => dealNotificationCatalogs[locale].statuses[status] ?? status;
