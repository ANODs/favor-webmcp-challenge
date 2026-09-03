"use client";

import Image from "next/image";
import { useState } from "react";

type Props = {
  avatarUrl?: string | null;
  displayName: string;
  className?: string;
  fallbackClassName?: string;
  sizes?: string;
};

export function UserAvatar({
  avatarUrl,
  displayName,
  className = "h-10 w-10",
  fallbackClassName = "text-sm",
  sizes = "40px",
}: Props) {
  const [failed, setFailed] = useState(false);
  const fallback = displayName.trim().replace(/^@/, "").charAt(0).toUpperCase() || "F";

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full bg-zinc-100 ring-1 ring-black/10 dark:bg-zinc-800 dark:ring-white/10 ${className}`}
    >
      <div className={`absolute inset-0 flex items-center justify-center font-bold text-zinc-500 dark:text-zinc-300 ${fallbackClassName}`}>
        {fallback}
      </div>
      {avatarUrl && !failed ? (
        <Image
          src={avatarUrl}
          alt={displayName}
          fill
          sizes={sizes}
          className="object-cover"
          unoptimized
          onError={() => setFailed(true)}
        />
      ) : null}
    </div>
  );
}
