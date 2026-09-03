import { buildTelegramMiniAppUrl } from "@/shared/lib/telegram";

type Props = {
  botUsername: string;
  label: string;
  startApp?: string;
  className?: string;
  tone?: "primary" | "secondary";
};

const toneClassName = {
  primary: "bg-zinc-950 text-white hover:bg-zinc-800",
  secondary: "border border-zinc-200 bg-transparent text-zinc-900 hover:bg-zinc-50",
} as const;

export function TelegramBotButton({
  botUsername,
  label,
  startApp,
  className = "",
  tone = "secondary",
}: Props) {
  return (
    <a
      href={buildTelegramMiniAppUrl(botUsername, startApp)}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-center text-sm font-medium transition ${toneClassName[tone]} ${className}`}
    >
      {label}
    </a>
  );
}
