"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

type FAQItemProps = {
  question: string;
  answer: string;
  isOpen: boolean;
  onClick: () => void;
};

function FAQItem({ question, answer, isOpen, onClick }: FAQItemProps) {
  return (
    <div className="border-b border-black/5 last:border-none">
      <button
        onClick={onClick}
        className="flex w-full items-center justify-between py-6 text-left focus:outline-none"
      >
        <span className="text-base font-semibold text-zinc-950 sm:text-lg">
          {question}
        </span>
        <span
          className={`ml-6 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/5 bg-zinc-50 transition-transform duration-300 ${
            isOpen ? "rotate-180 bg-zinc-100" : ""
          }`}
        >
          <ChevronDown className="h-4 w-4 text-zinc-500" />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <p className="pb-6 text-base leading-relaxed text-zinc-600">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FAQSection() {
  const t = useTranslations("Index.FAQ");
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    { question: t("q1"), answer: t("a1") },
    { question: t("q2"), answer: t("a2") },
    { question: t("q3"), answer: t("a3") },
    { question: t("q4"), answer: t("a4") },
  ];

  return (
    <section className="relative overflow-hidden rounded-[2.5rem] border border-black/5 bg-white p-6 shadow-md sm:p-12">
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-brand-accent/5 blur-[100px]" />
      <div className="relative z-10 flex flex-col gap-8 md:flex-row md:items-start md:gap-16">
        <div className="w-full md:w-1/3">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
            {t("subtitle")}
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
            {t("title")}
          </h2>
        </div>
        <div className="w-full flex-1">
          <div className="flex flex-col">
            {faqs.map((faq, index) => (
              <FAQItem
                key={index}
                question={faq.question}
                answer={faq.answer}
                isOpen={openIndex === index}
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
