"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Unbounded } from "next/font/google";
import { siteConfig, routes } from "@/shared/config";
import { Send, HelpCircle, MessagesSquare } from "lucide-react";
import Image from "next/image";

const unbounded = Unbounded({ subsets: ["latin", "cyrillic"] });

export function FooterSection() {
  const t = useTranslations("Index.Footer");

  return (
    <footer className="rounded-[2.5rem] border border-black/5 bg-zinc-950 px-6 py-12 text-zinc-400 sm:px-12 sm:py-16">
      <div className="flex flex-col gap-12 md:flex-row md:justify-between">
        <div className="max-w-xs">
          <div className={`flex items-center gap-2 text-2xl font-black text-white ${unbounded.className}`}>
            <Image src="/logo.svg" alt="Favor" width={28} height={28} />
            <span>Favor</span>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-zinc-500">
            {t("description")}
          </p>
          <div className="mt-6 flex items-center gap-4">
            <a
              href={siteConfig.links.telegram}
              target="_blank"
              rel="noreferrer"
              className="group flex h-10 w-10 items-center justify-center rounded-full bg-white/5 transition-colors hover:bg-white/10"
              title="Favor Bot"
            >
              <Send className="h-4 w-4 text-zinc-400 group-hover:text-white" />
            </a>
            <a
              href={siteConfig.links.channel}
              target="_blank"
              rel="noreferrer"
              className="group flex h-10 w-10 items-center justify-center rounded-full bg-white/5 transition-colors hover:bg-white/10"
              title={t("channel")}
            >
              <MessagesSquare className="h-4 w-4 text-zinc-400 group-hover:text-white" />
            </a>
            <a
              href={siteConfig.links.twitter}
              target="_blank"
              rel="noreferrer"
              className="group flex h-10 w-10 items-center justify-center rounded-full bg-white/5 transition-colors hover:bg-white/10"
              title="Twitter"
            >
              <svg className="h-4 w-4 fill-zinc-400 transition-colors group-hover:fill-white" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 22.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a
              href={siteConfig.links.support}
              target="_blank"
              rel="noreferrer"
              className="group flex h-10 w-10 items-center justify-center rounded-full bg-white/5 transition-colors hover:bg-white/10"
              title={t("support")}
            >
              <HelpCircle className="h-4 w-4 text-zinc-400 group-hover:text-white" />
            </a>
            <a
              href={siteConfig.links.youtube}
              target="_blank"
              rel="noreferrer"
              className="group flex h-10 w-10 items-center justify-center rounded-full bg-white/5 transition-colors hover:bg-white/10"
              title="YouTube"
            >
              <svg className="h-4 w-4 fill-zinc-400 transition-colors group-hover:fill-white" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            </a>
          </div>
        </div>

        <div className="flex flex-wrap gap-12 sm:gap-24">
          <div className="flex flex-col gap-4">
            <h4 className="font-semibold text-white">{t("legal")}</h4>
            <Link href={routes.terms} className="text-sm transition-colors hover:text-white">
              {t("terms")}
            </Link>
            <Link href={routes.privacy} className="text-sm transition-colors hover:text-white">
              {t("privacy")}
            </Link>
          </div>
          <div className="flex flex-col gap-4">
            <h4 className="font-semibold text-white">{t("community")}</h4>
            <a href={siteConfig.links.channel} target="_blank" rel="noreferrer" className="text-sm transition-colors hover:text-white">
              {t("channel")}
            </a>
            <a href={siteConfig.links.support} target="_blank" rel="noreferrer" className="text-sm transition-colors hover:text-white">
              {t("support")}
            </a>
            <a href={siteConfig.links.twitter} target="_blank" rel="noreferrer" className="text-sm transition-colors hover:text-white">
              Twitter
            </a>
            <a href={siteConfig.links.youtube} target="_blank" rel="noreferrer" className="text-sm transition-colors hover:text-white">
              YouTube
            </a>
          </div>
        </div>
      </div>
      
      <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row">
        <p className="text-xs text-zinc-600">
          © {new Date().getFullYear()} Favor. {t("allRightsReserved")}
        </p>
      </div>
    </footer>
  );
}
