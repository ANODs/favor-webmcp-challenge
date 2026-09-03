import { HomeClientWrapper } from "./home-client-wrapper";
import { BentoGrid } from "./bento-grid";
import { PopularContractsSection } from "./popular-contracts-section";
import { CallToActionSection } from "./call-to-action-section";
import { FAQSection } from "./faq-section";
import { FooterSection } from "./footer-section";
import { HomeSmoothScroll } from "./home-smooth-scroll";
import { FavorHubSection } from "@/widgets/favor-hub";
import type { ContractDto } from "@/entities/contract";
import type { PlatformStats } from "../server";

type Props = {
  popularContracts: ContractDto[];
  platformStats: PlatformStats;
};

export function HomeView({ popularContracts, platformStats }: Props) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-10 sm:py-14">
      <HomeSmoothScroll />
      <HomeClientWrapper>
        <BentoGrid stats={platformStats} />
        <FavorHubSection />
        <PopularContractsSection contracts={popularContracts} />
        <FAQSection />
        <CallToActionSection />
        <FooterSection />
      </HomeClientWrapper>
    </main>
  );
}
