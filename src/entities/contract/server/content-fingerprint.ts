import crypto from "node:crypto";

type ContractFingerprintInput = {
  titleRu?: string | null;
  titleEn?: string | null;
  descriptionRu?: string | null;
  descriptionEn?: string | null;
  category?: string | null;
  tags?: string[];
};

const normalize = (value: string | null | undefined) =>
  value?.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim() ?? "";

export function buildContractContentFingerprint(input: ContractFingerprintInput) {
  const normalized = JSON.stringify({
    titleRu: normalize(input.titleRu),
    titleEn: normalize(input.titleEn),
    descriptionRu: normalize(input.descriptionRu),
    descriptionEn: normalize(input.descriptionEn),
    category: normalize(input.category),
    tags: (input.tags ?? []).map(normalize).filter(Boolean).sort(),
  });

  return crypto.createHash("sha256").update(normalized).digest("hex");
}
