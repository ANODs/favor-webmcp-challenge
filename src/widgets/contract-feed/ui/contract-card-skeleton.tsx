import { Skeleton, SurfaceCard } from "@/shared/ui";

export function ContractCardSkeleton() {
  return (
    <SurfaceCard
      paddingClassName="p-0"
      className="relative overflow-hidden rounded-[2rem]"
      aria-hidden="true"
    >
      <div className="absolute right-3 top-3 z-10 flex gap-2 sm:right-4 sm:top-4">
        <Skeleton className="h-11 w-11 rounded-full bg-zinc-300/80 dark:bg-zinc-700/90" />
        <Skeleton className="h-11 w-11 rounded-full bg-zinc-300/80 dark:bg-zinc-700/90" />
      </div>

      <div className="sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(18rem,38%)]">
        <Skeleton className="aspect-square w-full rounded-none sm:col-start-2 sm:row-start-1 sm:h-full sm:aspect-auto sm:min-h-[460px]" />

        <div className="p-4 sm:col-start-1 sm:row-start-1 sm:flex sm:min-h-[460px] sm:flex-col sm:p-6">
          <div className="flex gap-2">
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-36 rounded-full" />
          </div>

          <div className="mt-5 space-y-3">
            <Skeleton className="h-7 w-4/5 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-white/10">
            <div className="space-y-2 px-4 py-4 sm:px-5">
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-3.5 w-32" />
            </div>
            <div className="space-y-2 border-l border-zinc-200 px-4 py-4 dark:border-white/10 sm:px-5">
              <Skeleton className="mx-auto h-8 w-24" />
              <Skeleton className="mx-auto h-3.5 w-28" />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-white/10">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className={`flex items-center gap-2.5 px-3 py-3.5 sm:px-4 ${
                  index % 2 === 1 ? "border-l border-zinc-200 dark:border-white/10" : ""
                } ${index > 1 ? "border-t border-zinc-200 dark:border-white/10" : ""}`}
              >
                <Skeleton className="h-5 w-5 shrink-0 rounded-full" />
                <Skeleton className="h-3.5 w-24" />
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 sm:mt-auto sm:pt-4">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3.5 w-14" />
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}
