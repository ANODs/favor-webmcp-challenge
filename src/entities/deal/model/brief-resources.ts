import { z } from "zod";

export const DEAL_BRIEF_RESOURCE_LIMIT = 10;

const httpUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  }, "Only HTTP and HTTPS links are supported");

export const dealBriefResourceSchema = z
  .object({
    kind: z.literal("link"),
    url: httpUrlSchema,
    label: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

export const dealBriefResourcesSchema = z
  .array(dealBriefResourceSchema)
  .max(DEAL_BRIEF_RESOURCE_LIMIT)
  .superRefine((resources, context) => {
    const urls = new Set<string>();

    resources.forEach((resource, index) => {
      const normalizedUrl = new URL(resource.url).toString();
      if (urls.has(normalizedUrl)) {
        context.addIssue({
          code: "custom",
          message: "Duplicate project material link",
          path: [index, "url"],
        });
      }
      urls.add(normalizedUrl);
    });
  });

export type DealBriefResource = z.infer<typeof dealBriefResourceSchema>;

export const normalizeDealBriefResources = (
  value: unknown,
): DealBriefResource[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const parsed = dealBriefResourceSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
};
