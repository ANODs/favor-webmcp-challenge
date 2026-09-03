"use client";

import { cn } from "@/shared/lib/cn";

type Props = {
  className?: string;
  size?: number;
};

export function TelegramLogo({ className, size = 14 }: Props) {
  return (
    <svg 
      className={cn("shrink-0", className)}
      width={size} 
      height={size} 
      viewBox="0 0 14 14" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M9.96 4.56L8.84 10.1C8.75 10.49 8.52 10.59 8.2 10.41L6.4 9.08L5.53 9.92C5.44 10.01 5.36 10.09 5.18 10.09L5.31 8.24L8.67 5.2C8.81 5.08 8.64 5.01 8.45 5.13L4.29 7.75L2.5 7.19C2.11 7.07 2.1 6.8 2.58 6.61L9.55 3.92C9.87 3.8 10.14 4 9.96 4.56Z"
        fill="currentColor"
      />
    </svg>
  );
}
