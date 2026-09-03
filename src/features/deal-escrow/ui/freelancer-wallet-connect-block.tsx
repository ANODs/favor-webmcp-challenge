import { TonConnectButton } from "@tonconnect/ui-react";
import { Button } from "@/shared/ui";
import { useTranslations } from "next-intl";

type Props = {
  transitionMutation: any;
  availableTransitions: string[];
};

export function FreelancerWalletConnectBlock({ transitionMutation, availableTransitions }: Props) {
  const t = useTranslations("Escrow");
  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl bg-amber-500/10 p-5 border border-amber-500/20 shadow-md">
        <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
          {t("connect_wallet_warning")}
        </h4>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-normal">
          {t("connect_wallet_desc1")} 
          {t("connect_wallet_desc2")} 
          {t("connect_wallet_desc3")}
        </p>
        <div className="mt-1 flex justify-center">
          <TonConnectButton />
        </div>
      </div>
      {availableTransitions.includes("rejected") && (
        <Button
          onClick={() => transitionMutation.mutate("rejected")}
          loading={transitionMutation.isPending && transitionMutation.variables === "rejected"}
          variant="primary"
          shape="rounded-2xl"
          className="border border-red-500/30 bg-red-500/10 text-red-700 hover:bg-red-500/20 dark:text-red-400 font-semibold"
          fullWidth
        >
          {t("reject_deal")}
        </Button>
      )}
    </div>
  );
}
