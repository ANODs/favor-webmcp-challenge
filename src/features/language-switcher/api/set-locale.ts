"use server";

import { cookies } from "next/headers";
import { getCurrentUser } from "@/shared/lib/auth";
import { prisma } from "@/shared/lib/prisma";
import { revalidatePath } from "next/cache";

export async function setLocaleAction(locale: "ru" | "en") {
  const cookieStore = await cookies();
  cookieStore.set("NEXT_LOCALE", locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });

  const user = await getCurrentUser();
  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { languageCode: locale },
    });
  }

  revalidatePath("/");
}
