type ParsedTelegramPostUrl = {
  canonicalPostUrl: string;
  publicFeedPostUrl: string;
  canonicalSinglePostUrl: string;
  channelUrl: string;
  channelHandle: string;
  postId: string;
};

const TELEGRAM_HOSTS = new Set(["t.me", "telegram.me", "www.t.me", "www.telegram.me"]);
export const parseTelegramPostUrl = (input: string): ParsedTelegramPostUrl => {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(input);
  } catch {
    throw new Error("TELEGRAM_POST_URL_INVALID");
  }

  if (!TELEGRAM_HOSTS.has(parsedUrl.hostname)) {
    throw new Error("TELEGRAM_POST_HOST_UNSUPPORTED");
  }

  const segments = parsedUrl.pathname.split("/").filter(Boolean);

  if (segments.length < 2) {
    throw new Error("TELEGRAM_POST_PATH_INVALID");
  }

  const hasPublicMirrorSegment = segments[0] === "s";
  const startIndex = hasPublicMirrorSegment ? 1 : 0;

  if (segments.length - startIndex < 2) {
    throw new Error("TELEGRAM_POST_PATH_INVALID");
  }

  const postId = segments[segments.length - 1];
  const channelHandle = segments[startIndex];

  if (!/^[a-z][a-z0-9_]{3,31}$/i.test(channelHandle)) {
    throw new Error("TELEGRAM_POST_PATH_INVALID");
  }

  const messagePath = segments.slice(startIndex + 1);
  if (!messagePath.every((segment) => /^[1-9]\d*$/.test(segment))) {
    throw new Error("TELEGRAM_POST_PATH_INVALID");
  }
  
  // Use all segments except 's' to construct the path (handles topic groups like group/123/456)
  const pathWithoutS = segments.slice(startIndex).join("/");

  return {
    canonicalPostUrl: `https://t.me/${pathWithoutS}`,
    publicFeedPostUrl: `https://t.me/${pathWithoutS}?embed=1&t=${Date.now()}`,
    canonicalSinglePostUrl: `https://t.me/${pathWithoutS}?single`,
    channelUrl: `https://t.me/${channelHandle}`,
    channelHandle,
    postId,
  };
};
