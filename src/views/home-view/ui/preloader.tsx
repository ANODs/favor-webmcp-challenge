"use client";

import { motion, AnimatePresence } from "framer-motion";

export function Preloader({
  isVisible,
  label,
}: {
  isVisible: boolean;
  label: string;
}) {
  return (
    <>
      <AnimatePresence>
        {isVisible && (
          <motion.div
            key="preloader"
            data-home-preloader
            role="status"
            aria-live="polite"
            aria-label={label}
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-white text-zinc-950"
          >
            <motion.svg
              width="120"
              height="120"
              viewBox="0 0 512 512"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.28 }}
            >
              <motion.path
                d="M73 0H438.5V117.5H201V171H438.5V276.5H202V512H73V223.5H202L201 171H73V0Z"
                stroke="currentColor"
                fill="currentColor"
                strokeWidth="4"
                initial={{ pathLength: 0, fillOpacity: 0 }}
                animate={{ pathLength: 1, fillOpacity: 1 }}
                transition={{
                  pathLength: { duration: 1.2, ease: "easeInOut" },
                  fillOpacity: { duration: 0.6, ease: "easeIn", delay: 0.6 },
                }}
              />
            </motion.svg>
          </motion.div>
        )}
      </AnimatePresence>
      <noscript>
        <style>{`[data-home-preloader] { display: none !important; }`}</style>
      </noscript>
    </>
  );
}
