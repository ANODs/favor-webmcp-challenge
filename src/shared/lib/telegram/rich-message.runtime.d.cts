export type TelegramRichVideoInput = {
  html: string;
  media: [
    {
      id: string;
      media: {
        type: "video";
        media: string;
        supports_streaming: true;
        width?: number;
        height?: number;
        duration?: number;
      };
    },
  ];
};

export function buildTelegramRichVideoInput(input: {
  html: string;
  mediaId: string;
  attachmentName: string;
  width?: number;
  height?: number;
  duration?: number;
}): TelegramRichVideoInput;
