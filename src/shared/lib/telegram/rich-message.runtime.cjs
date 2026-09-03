"use strict";

const RICH_MEDIA_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function assertRichMediaIdentifier(value, field) {
  if (!RICH_MEDIA_ID_PATTERN.test(value)) {
    throw new TypeError(`${field} must contain 1-64 letters, digits, underscores, or hyphens`);
  }
}

function buildTelegramRichVideoInput({
  html,
  mediaId,
  attachmentName,
  width,
  height,
  duration,
}) {
  assertRichMediaIdentifier(mediaId, "mediaId");
  assertRichMediaIdentifier(attachmentName, "attachmentName");

  return {
    html,
    media: [
      {
        id: mediaId,
        media: {
          type: "video",
          media: `attach://${attachmentName}`,
          supports_streaming: true,
          width,
          height,
          duration,
        },
      },
    ],
  };
}

module.exports = {
  buildTelegramRichVideoInput,
};
