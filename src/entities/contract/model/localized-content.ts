import { detectContractTextLanguage } from "./form";

type LocalizedContractSource = {
  titleRu?: string | null;
  titleEn?: string | null;
  descriptionRu?: string | null;
  descriptionEn?: string | null;
};

const normalize = (value?: string | null) => value?.trim() ?? "";

const buildTitleFromSource = (value: string) => {
  const firstLine = value
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[#*\-\s]+/, ""))
    .find((line) => line.length >= 5);

  return firstLine ? Array.from(firstLine).slice(0, 120).join("") : "";
};

export const resolveLocalizedContractContent = (
  source: LocalizedContractSource,
  locale: "ru" | "en",
  fallbackTitle: string,
  fallbackDescription = "",
) => {
  const localizedTitle = normalize(
    locale === "en" ? source.titleEn : source.titleRu,
  );
  const localizedDescription = normalize(
    locale === "en" ? source.descriptionEn : source.descriptionRu,
  );
  const otherTitle = normalize(
    locale === "en" ? source.titleRu : source.titleEn,
  );
  const otherDescription = normalize(
    locale === "en" ? source.descriptionRu : source.descriptionEn,
  );
  const matchingDescription = [localizedDescription, otherDescription].find(
    (description) =>
      description && detectContractTextLanguage(description) === locale,
  ) ?? "";

  return {
    title:
      localizedTitle ||
      buildTitleFromSource(matchingDescription) ||
      otherTitle ||
      fallbackTitle,
    description:
      matchingDescription ||
      localizedDescription ||
      otherDescription ||
      fallbackDescription,
  };
};
