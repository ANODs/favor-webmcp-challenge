import { useTranslations } from "next-intl";

type Props = {
  isEscrow: boolean;
};

export function DealTypeBadge({ isEscrow }: Props) {
  const t = useTranslations("DealType");
  const type = isEscrow ? "safe" : "direct";

  return (
    <span
      data-deal-type={type}
      className="inline-flex rounded-full border border-zinc-200 bg-white/75 px-3 py-1.5 text-xs font-semibold text-zinc-700 backdrop-blur-sm dark:border-white/12 dark:bg-zinc-900/80 dark:text-zinc-100"
    >
      {t(isEscrow ? "SafeDeal" : "DirectDeal")}
    </span>
  );
}
