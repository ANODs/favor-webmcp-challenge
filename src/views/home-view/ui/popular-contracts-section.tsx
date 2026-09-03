import { useTranslations } from "next-intl";
import { ContractCard } from "@/widgets/contract-feed";
import type { ContractDto } from "@/entities/contract";

import { HOME_SECTION_IDS } from "./home-section-ids";

type Props = {
  contracts: ContractDto[];
};

export function PopularContractsSection({ contracts }: Props) {
  const t = useTranslations("Index.PopularContracts");

  return (
    <section
      id={HOME_SECTION_IDS.popularContracts}
      className="relative scroll-mt-8 overflow-hidden rounded-[2.5rem] border border-black/5 bg-white p-6 shadow-md sm:p-12"
    >
      {/* Decorative Glow */}
      <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-blue-500/10 blur-[100px] pointer-events-none" />

      <div className="relative z-10 flex flex-col justify-between gap-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
            {t("subtitle")}
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
            {t("title")}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-zinc-600">
            {t("description")}
          </p>
        </div>
      </div>

      {contracts.length > 0 ? (
        <div className="relative z-10 mt-10 grid gap-4">
          {contracts.map((contract) => (
              <ContractCard key={contract.id} contract={contract} />
          ))}
        </div>
      ) : (
        <div className="relative z-10 mt-10 rounded-[2rem] border border-black/5 bg-zinc-100/50 p-8 text-center text-base leading-relaxed text-zinc-600 backdrop-blur-sm">
          {t("noContracts")}
        </div>
      )}
    </section>
  );
}
