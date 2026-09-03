import { NextRequest, NextResponse } from "next/server";
import { fetchTelegramAvatar } from "@/shared/lib/telegram/avatar.server";
import { proxyFetch } from "@/shared/lib/telegram/proxy-fetch";

const TELEGRAM_IMAGE_HOSTS = new Set([
  "t.me",
  "telegram.me",
  "www.t.me",
  "www.telegram.me",
]);

const isAllowedTelegramImageUrl = (value: string) => {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();

    return url.protocol === "https:" && (
      TELEGRAM_IMAGE_HOSTS.has(hostname) ||
      hostname === "telegram.org" ||
      hostname.endsWith(".telegram.org") ||
      hostname === "telegram-cdn.org" ||
      hostname.endsWith(".telegram-cdn.org")
    );
  } catch {
    return false;
  }
};

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  const telegramId = request.nextUrl.searchParams.get("telegramId")?.trim();

  if (!url && !telegramId) {
    return new NextResponse("Missing url or telegramId parameter", { status: 400 });
  }

  if (telegramId && !/^\d+$/.test(telegramId)) {
    return new NextResponse("Invalid telegramId parameter", { status: 400 });
  }

  if (url && !isAllowedTelegramImageUrl(url)) {
    return new NextResponse("Unsupported image host", { status: 400 });
  }

  try {
    const res = telegramId
      ? await fetchTelegramAvatar(telegramId)
      : await proxyFetch(url!, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          },
        });

    if (!res) {
      return new NextResponse("Telegram avatar not found", { status: 404 });
    }

    if (!res.ok) {
      return new NextResponse("Failed to fetch image", { status: res.status });
    }

    const contentType = res.headers.get("content-type");

    if (!contentType?.toLowerCase().startsWith("image/")) {
      return new NextResponse("Telegram resource is not an image", { status: 415 });
    }

    const headers = new Headers();
    headers.set("content-type", contentType);
    headers.set("x-content-type-options", "nosniff");
    headers.set(
      "cache-control",
      telegramId
        ? "public, max-age=300, stale-while-revalidate=3600"
        : "public, max-age=31536000, immutable",
    );

    return new NextResponse(res.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Image proxy error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
