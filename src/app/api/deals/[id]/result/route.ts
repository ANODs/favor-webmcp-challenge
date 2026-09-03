import { handleRouteError } from "@/shared/lib/api";
import { requireUser } from "@/shared/lib/auth";
import { env } from "@/shared/config/env";
import { prisma } from "@/shared/lib/prisma";
import { proxyFetch } from "@/shared/lib/telegram/proxy-fetch";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const deal = await prisma.deal.findUnique({
      where: {
        id: Number(id),
      },
    });

    if (!deal) {
      return new Response("Deal not found.", { status: 404 });
    }

    if (deal.customerId !== user.id && deal.freelancerId !== user.id) {
      return new Response("FORBIDDEN", { status: 403 });
    }

    if (!deal.resultFileId) {
      return new Response("The deal has no attached result file.", { status: 404 });
    }

    // Call Telegram API to get file path
    const fileRes = await proxyFetch(`https://api.telegram.org/bot${env.telegramBotToken}/getFile?file_id=${deal.resultFileId}`);
    const fileData = await fileRes.json();

    if (!fileRes.ok || !fileData.ok) {
      return new Response("Could not retrieve the file from Telegram.", { status: 500 });
    }

    const filePath = fileData.result.file_path;
    const downloadUrl = `https://api.telegram.org/file/bot${env.telegramBotToken}/${filePath}`;

    // Return a redirect to the Telegram file URL directly, or we can proxy it.
    // Proxying is better so we don't expose the bot token in the URL.
    const downloadRes = await proxyFetch(downloadUrl);
    
    if (!downloadRes.ok) {
      return new Response("Could not download the file.", { status: 500 });
    }

    const headers = new Headers(downloadRes.headers);
    // Force download by setting content-disposition if not set
    if (!headers.has('content-disposition')) {
      const filename = filePath.split('/').pop() || 'result_file';
      headers.set('content-disposition', `attachment; filename="${filename}"`);
    }

    return new Response(downloadRes.body, {
      status: downloadRes.status,
      headers,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
