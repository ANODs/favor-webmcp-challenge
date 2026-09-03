import type { Prisma } from "@prisma/client";

import {
  CONTRACT_ERROR_CODES,
  CONTRACT_TITLE_MAX_LENGTH,
  CONTRACT_TITLE_MIN_LENGTH,
  CONTRACT_TITLE_VALIDATION_CODES,
} from "@/shared/config";
import { prisma } from "@/shared/lib/prisma";

type ContractSlugClient = Pick<Prisma.TransactionClient, "contract">;

const NORMALIZE_PATTERN = /[^a-z0-9]+/g;
const CYRILLIC_PATTERN = /[\u0430-\u044f\u0451]/g;
const CYRILLIC_TRANSLITERATION: Record<string, string> = {
  "\u0430": "a",
  "\u0431": "b",
  "\u0432": "v",
  "\u0433": "g",
  "\u0434": "d",
  "\u0435": "e",
  "\u0451": "e",
  "\u0436": "zh",
  "\u0437": "z",
  "\u0438": "i",
  "\u0439": "y",
  "\u043a": "k",
  "\u043b": "l",
  "\u043c": "m",
  "\u043d": "n",
  "\u043e": "o",
  "\u043f": "p",
  "\u0440": "r",
  "\u0441": "s",
  "\u0442": "t",
  "\u0443": "u",
  "\u0444": "f",
  "\u0445": "h",
  "\u0446": "c",
  "\u0447": "ch",
  "\u0448": "sh",
  "\u0449": "sch",
  "\u044a": "",
  "\u044b": "y",
  "\u044c": "",
  "\u044d": "e",
  "\u044e": "yu",
  "\u044f": "ya",
};

export const validateContractTitle = (title: string) => {
  const value = title.trim();

  if (value.length < CONTRACT_TITLE_MIN_LENGTH) {
    return {
      ok: false as const,
      code: CONTRACT_TITLE_VALIDATION_CODES.tooShort,
    };
  }

  if (value.length > CONTRACT_TITLE_MAX_LENGTH) {
    return {
      ok: false as const,
      code: CONTRACT_TITLE_VALIDATION_CODES.tooLong,
    };
  }

  return { ok: true as const };
};

export const slugifyTitle = (title: string) => {
  const transliterated = title
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\u0430-\u044f\u04510-9\s-]/gi, "")
    .replace(
      CYRILLIC_PATTERN,
      (character) => CYRILLIC_TRANSLITERATION[character] ?? "",
    );

  return transliterated
    .replace(NORMALIZE_PATTERN, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
};

export const ensureUniqueSlugWithClient = async (
  database: ContractSlugClient,
  baseTitle: string,
  excludeId?: number,
) => {
  const titleValidation = validateContractTitle(baseTitle);

  if (!titleValidation.ok) {
    return {
      ok: false as const,
      code: titleValidation.code,
      reason: titleValidation.code,
    };
  }

  const baseSlug = slugifyTitle(baseTitle);

  if (!baseSlug) {
    return {
      ok: false as const,
      code: CONTRACT_ERROR_CODES.slugEmpty,
      reason: CONTRACT_ERROR_CODES.slugEmpty,
    };
  }

  const existing = await database.contract.findMany({
    where: excludeId
      ? {
          slug: {
            startsWith: baseSlug,
          },
          NOT: { id: excludeId },
        }
      : {
          slug: {
            startsWith: baseSlug,
          },
        },
    select: { slug: true },
  });

  if (!existing.some((item) => item.slug === baseSlug)) {
    return {
      ok: true as const,
      slug: baseSlug,
    };
  }

  let suffix = 2;
  let candidate = `${baseSlug}-${suffix}`;

  while (existing.some((item) => item.slug === candidate)) {
    suffix += 1;
    candidate = `${baseSlug}-${suffix}`;
  }

  return {
    ok: true as const,
    slug: candidate,
  };
};

export const ensureUniqueSlug = (baseTitle: string, excludeId?: number) =>
  ensureUniqueSlugWithClient(prisma, baseTitle, excludeId);
