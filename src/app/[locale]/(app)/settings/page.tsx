import { env } from "@/shared/config";
import { getCurrentUser } from "@/shared/lib/auth";
import { SettingsPanel } from "@/widgets/settings-panel";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const currentUser = await getCurrentUser();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6">
      <SettingsPanel
        appVersion={env.appVersion}
        botUsername={env.telegramBotUsername}
        showModeration={currentUser?.role === "moderator"}
      />
    </main>
  );
}
