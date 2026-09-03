import { createReadStream } from "node:fs";
import { Readable } from "node:stream";

import { getStoryMedia, parseStoryMediaRange } from "@/features/share-telegram-story/server";

export const runtime = "nodejs";

const baseHeaders = {
  "Accept-Ranges": "bytes",
  "Cache-Control": "public, max-age=300, immutable",
  "Content-Type": "video/mp4",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(
  request: Request,
  context: RouteContext<"/api/telegram/story-media/[token]">,
) {
  const { token } = await context.params;
  const media = await getStoryMedia(token);
  if (!media) return new Response("Not found", { status: 404 });

  const range = parseStoryMediaRange(request.headers.get("range"), media.size);
  if (range === "invalid") {
    return new Response(null, {
      status: 416,
      headers: { ...baseHeaders, "Content-Range": `bytes */${media.size}` },
    });
  }

  const start = range?.start ?? 0;
  const end = range?.end ?? media.size - 1;
  const stream = Readable.toWeb(createReadStream(media.path, { start, end }));
  return new Response(stream as ReadableStream<Uint8Array>, {
    status: range ? 206 : 200,
    headers: {
      ...baseHeaders,
      "Content-Length": String(end - start + 1),
      ...(range ? { "Content-Range": `bytes ${start}-${end}/${media.size}` } : {}),
    },
  });
}

export async function HEAD(
  _request: Request,
  context: RouteContext<"/api/telegram/story-media/[token]">,
) {
  const { token } = await context.params;
  const media = await getStoryMedia(token);
  if (!media) return new Response(null, { status: 404 });
  return new Response(null, {
    headers: { ...baseHeaders, "Content-Length": String(media.size) },
  });
}
