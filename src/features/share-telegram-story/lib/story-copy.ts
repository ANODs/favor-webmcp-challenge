import type { TelegramStoryLocale, TelegramStoryTarget } from "../model/types";
import type { TelegramStoryShareParams } from "@/shared/lib/telegram";

import englishCopy from "./story-copy.en.json";
import russianCopy from "./story-copy.ru.json";

type TelegramStoryCopy = {
  [Key in keyof typeof englishCopy]: string;
};

const copyByLocale = {
  en: englishCopy,
  ru: russianCopy,
} satisfies Record<TelegramStoryLocale, TelegramStoryCopy>;

const truncate = (value: string, maxLength: number) => {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
};

export const getTelegramStoryShareCopy = (
  target: TelegramStoryTarget,
  locale: TelegramStoryLocale,
) => {
  const dictionary = copyByLocale[locale];
  const caption =
    target.type === "contract"
      ? dictionary.contractCaption
      : target.type === "profile"
        ? dictionary.profileCaption
        : dictionary.referralCaption;
  const availableUrlLength = Math.max(0, 200 - target.url.length - 1);

  return {
    text: `${truncate(caption, availableUrlLength)}\n${target.url}`.slice(0, 200),
    widgetName: dictionary.widget,
  };
};

export const getTelegramStoryShareParams = (
  target: TelegramStoryTarget,
  locale: TelegramStoryLocale,
): TelegramStoryShareParams => {
  const storyCopy = getTelegramStoryShareCopy(target, locale);
  return {
    text: storyCopy.text,
    widget_link: {
      url: target.url,
      name: storyCopy.widgetName,
    },
  };
};
