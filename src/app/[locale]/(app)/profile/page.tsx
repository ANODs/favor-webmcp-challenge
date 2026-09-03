import { redirect } from "next/navigation";

import { env } from "@/shared/config/env";
import { routes } from "@/shared/config/routes";
import { getCurrentUser } from "@/shared/lib/auth";
import { getUserProfileSlug } from "@/shared/lib/profile";
import { ProfileView } from "@/views/profile-view";

export default async function ProfilePage() {
  const user = await getCurrentUser();

  if (user) {
    redirect(routes.profileBySlug(getUserProfileSlug(user)));
  }

  return <ProfileView botUsername={env.telegramBotUsername} />;
}

