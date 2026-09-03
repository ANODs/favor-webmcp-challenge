import { Button } from "@/shared/ui";
import { useTranslations } from "next-intl";

type Props = {
  handleArbitrationResolve: (outcome: "freelancer" | "customer") => Promise<void>;
  loading: boolean;
};

export function ModeratorArbitrationPanel({ handleArbitrationResolve, loading }: Props) {
  const t = useTranslations("Arbitration");
  return (
    <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-purple-500/10 p-5 border border-purple-500/20 shadow-lg">
      <h4 className="text-sm font-bold text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
        {t("panel_title")}
      </h4>
      <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-normal">
        {t("panel_desc")}
      </p>
      <div className="flex flex-col gap-2 mt-2">
        <Button
          onClick={() => handleArbitrationResolve("freelancer")}
          loading={loading}
          disabled={loading}
          variant="primary"
          shape="rounded-2xl"
          className="bg-purple-600 hover:bg-purple-500 text-white font-bold"
          fullWidth
        >
          {t("resolve_freelancer")}
        </Button>
        <Button
          onClick={() => handleArbitrationResolve("customer")}
          loading={loading}
          disabled={loading}
          variant="primary"
          shape="rounded-2xl"
          className="border border-purple-500/30 bg-purple-500/10 text-purple-700 hover:bg-purple-500/20 dark:text-purple-300"
          fullWidth
        >
          {t("resolve_customer")}
        </Button>
      </div>
    </div>
  );
}
