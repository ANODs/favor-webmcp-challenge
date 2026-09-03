import { Button } from "@/shared/ui";
import { useTranslations } from "next-intl";

type Props = {
  handleRaiseDispute: () => Promise<void>;
  loading: boolean;
};

export function RaiseDisputeButton({ handleRaiseDispute, loading }: Props) {
  const t = useTranslations("Arbitration");
  return (
    <Button
      onClick={handleRaiseDispute}
      variant="primary"
      shape="rounded-2xl"
      loading={loading}
      disabled={loading}
      className="border border-red-500/30 bg-red-500/10 text-red-700 hover:bg-red-500/20 dark:text-red-400 font-semibold mt-2"
      fullWidth
    >
      {t("raise_dispute")}
    </Button>
  );
}
