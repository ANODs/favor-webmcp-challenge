import { revalidatePath } from "next/cache";

import { routing } from "@/i18n/routing";

import { getLocalizedPathname } from "./seo";

export function revalidateLocalizedPath(pathname: string) {
  for (const locale of routing.locales) {
    revalidatePath(getLocalizedPathname(locale, pathname));
  }
}
