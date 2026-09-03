import { routes } from "@/shared/config/routes";
import { revalidateLocalizedPath } from "@/shared/lib/revalidation";

export const revalidateContractPage = (slug: string) =>
  revalidateLocalizedPath(routes.contractBySlug(slug));
