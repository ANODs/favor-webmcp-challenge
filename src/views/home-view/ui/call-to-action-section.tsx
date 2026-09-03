import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { routes } from "@/shared/config/routes";

export function CallToActionSection() {
  const t = useTranslations("Index.CTA");

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-black/5 bg-white p-8 text-zinc-900 shadow-md sm:p-10">
      <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 rounded-full bg-blue-500/10 blur-[80px]" />
      <div className="relative z-10">
        <h2 className="text-3xl font-semibold tracking-tight">
          {t("title")}
        </h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-600 sm:text-base">
          {t("description")}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={routes.createContract}
            className="rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium !text-white transition-all hover:bg-zinc-700 hover:scale-105"
          >
            {t("createBtn")}
          </Link>
          <Link
            href={routes.feed}
            className="rounded-full border border-black/10 bg-black/5 backdrop-blur-md px-6 py-3 text-sm font-medium text-zinc-900 transition hover:bg-black/10"
          >
            {t("feedBtn")}
          </Link>
        </div>
      </div>
    </section>
  );
}
