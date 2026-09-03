import "dotenv/config";

const BASE_URL = process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL;
const CRON_SECRET = process.env.CRON_SECRET;

async function main() {
  console.log("[cron] Starting remove-expired-premium job...");

  if (!BASE_URL) {
    console.error("[cron] BASE_URL or NEXT_PUBLIC_BASE_URL env variable is required.");
    process.exit(1);
  }

  if (!CRON_SECRET) {
    console.error("[cron] CRON_SECRET env variable is required.");
    process.exit(1);
  }

  const url = `${BASE_URL}/api/cron/revalidate-expired-premium`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CRON_SECRET}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[cron] Request failed: ${response.status} ${text}`);
    process.exit(1);
  }

  const data = await response.json();
  const reconciliation = data.data?.subscriptionReconciliation;
  console.log(
    `[cron] Done. Users downgraded: ${data.data?.usersUpdated ?? 0}, contracts cleared: ${data.data?.contractsUpdated ?? 0}, subscription intents attempted: ${reconciliation?.attempted ?? 0}, activated: ${reconciliation?.activated ?? 0}, expired: ${reconciliation?.expired ?? 0}, failed: ${reconciliation?.failed ?? 0}`
  );
}

main().catch((err) => {
  console.error("[cron] Unexpected error:", err);
  process.exit(1);
});
