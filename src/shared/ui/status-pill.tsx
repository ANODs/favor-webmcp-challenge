type Props = {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
};

const toneClassName: Record<NonNullable<Props["tone"]>, string> = {
  neutral: "bg-zinc-100 text-zinc-700",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-700",
  info: "bg-blue-100 text-blue-700",
};

export function StatusPill({ label, tone = "neutral" }: Props) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${toneClassName[tone]}`}
    >
      {label}
    </span>
  );
}
