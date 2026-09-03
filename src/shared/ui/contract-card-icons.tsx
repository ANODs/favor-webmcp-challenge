import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function HeartIcon({ filled = false, ...props }: IconProps & { filled?: boolean }) {
  return (
    <svg {...iconProps} {...props} fill={filled ? "currentColor" : "none"}>
      <path d="M20.8 5.9c-1.8-2.1-5.2-2.2-7.1-.3L12 7.3l-1.7-1.7C8.4 3.7 5 3.8 3.2 5.9c-1.7 2-1.5 5 .4 6.9L12 21l8.4-8.2c1.9-1.9 2.1-4.9.4-6.9Z" />
    </svg>
  );
}

export function ShareIcon(props: IconProps) {
  return (
    <svg {...iconProps} {...props}>
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5" />
    </svg>
  );
}

export function PeopleIcon(props: IconProps) {
  return (
    <svg {...iconProps} {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.8 19v-1.2A5.2 5.2 0 0 1 9 12.6a5.2 5.2 0 0 1 5.2 5.2V19" />
      <path d="M15 5.6a3 3 0 0 1 0 5.8M16.4 13.1a5.2 5.2 0 0 1 3.8 5V19" />
    </svg>
  );
}

export function CompletedIcon(props: IconProps) {
  return (
    <svg {...iconProps} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.2 12.1 2.4 2.4 5.2-5.3" />
    </svg>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M2.4 12s3.5-6 9.6-6 9.6 6 9.6 6-3.5 6-9.6 6-9.6-6-9.6-6Z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M7 3v3M17 3v3M4 9h16" />
      <rect x="4" y="5" width="16" height="16" rx="3" />
      <path d="M8 13h2M14 13h2M8 17h2M14 17h2" />
    </svg>
  );
}

export function DocumentIcon(props: IconProps) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M14 3v5h5M9 13h6M9 17h5" />
    </svg>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <svg {...iconProps} {...props}>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5.5 21v-1.8a6.5 6.5 0 0 1 13 0V21" />
    </svg>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M12 3v12M7.5 10.5 12 15l4.5-4.5" />
      <path d="M5 20h14" />
    </svg>
  );
}

export function MessageIcon(props: IconProps) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M5 18.5 3.5 21l3.8-.8A9 9 0 1 0 5 18.5Z" />
      <path d="M8 10h8M8 14h5" />
    </svg>
  );
}
