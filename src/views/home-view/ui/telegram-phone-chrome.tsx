"use client";

import { ArrowLeft, MoreHorizontal } from "lucide-react";

import {
  TELEGRAM_SCREEN_LAYOUT,
  TELEGRAM_SCREEN_THEME,
} from "./telegram-phone-chat-theme";

export function TelegramPhoneStatusBar({ time }: { time: string }) {
  return (
    <div
      className="relative z-30 flex items-center justify-between px-5 text-[10px] font-extrabold text-white"
      style={{
        backgroundColor: TELEGRAM_SCREEN_THEME.statusBar,
        height: TELEGRAM_SCREEN_LAYOUT.statusBarHeight,
      }}
    >
      <time>{time}</time>
      <span
        aria-hidden="true"
        className="absolute left-1/2 top-2 h-7 w-24 -translate-x-1/2 rounded-full bg-black"
      />
      <div className="flex items-center gap-2" aria-hidden="true">
        <span className="flex items-end gap-[2px]">
          {[5, 8, 11].map((height) => (
            <i
              key={height}
              className="block w-[3px] rounded-sm bg-white/90"
              style={{ height }}
            />
          ))}
        </span>
        <span className="relative h-3 w-4">
          <i className="absolute inset-x-0 bottom-0 h-2 rounded-t-full border border-white/85 border-b-0" />
          <i className="absolute bottom-0 left-1/2 h-0.5 w-0.5 -translate-x-1/2 rounded-full bg-white/85" />
        </span>
        <span className="relative h-[11px] w-[19px] rounded-[3px] border border-white/85 p-[2px]">
          <i className="block h-full w-[12px] rounded-[1px] bg-white/85" />
          <i className="absolute -right-[3px] top-[3px] h-1 w-0.5 rounded-r bg-white/70" />
        </span>
      </div>
    </div>
  );
}

export function TelegramPhoneHeader({
  avatar,
  title,
  subtitle,
  contextLabel,
}: {
  avatar: string;
  title: string;
  subtitle: string;
  contextLabel?: string;
}) {
  return (
    <div
      className="flex items-center gap-3 border-b border-white/10 px-3.5"
      style={{
        backgroundColor: TELEGRAM_SCREEN_THEME.header,
        height: TELEGRAM_SCREEN_LAYOUT.headerHeight,
      }}
    >
      <ArrowLeft className="h-5 w-5 text-[#8b7dff]" aria-hidden="true" />
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[linear-gradient(145deg,#4033c4,#6553ef)] text-[11px] font-black text-white">
        {avatar}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-extrabold text-white">{title}</p>
        <p className="mt-0.5 truncate text-[10px] font-semibold text-[#9188ff]">
          {subtitle}
        </p>
      </div>
      <span className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.05]">
        <MoreHorizontal className="h-5 w-5 text-white/45" aria-hidden="true" />
      </span>
      {contextLabel ? <span className="sr-only">{contextLabel}</span> : null}
    </div>
  );
}
