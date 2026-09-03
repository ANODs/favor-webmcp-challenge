import { Skeleton, SurfaceCard } from "@/shared/ui";

export function ProfileViewSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <SurfaceCard paddingClassName="p-4 sm:p-6">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <Skeleton className="h-16 w-16 shrink-0 rounded-full sm:h-20 sm:w-20 md:h-24 md:w-24" />
          <div className="min-w-0 flex-1 pt-1 sm:pt-0">
            <Skeleton className="hidden h-4 w-56 sm:block" />
            <Skeleton className="h-7 w-40 sm:mt-3 sm:h-9 sm:w-56" />
            <Skeleton className="mt-2 h-4 w-28" />
            <div className="mt-3 hidden gap-2 sm:flex">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 sm:mt-6 sm:gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="min-w-0 rounded-2xl bg-zinc-50 px-2.5 py-3 sm:rounded-3xl sm:p-4"
            >
              <Skeleton className="h-3 w-12 sm:w-20" />
              <Skeleton className="mt-2 h-5 w-10 sm:h-6 sm:w-16" />
            </div>
          ))}
        </div>

        <div className="mt-6 hidden grid-cols-3 gap-3 md:grid">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      </SurfaceCard>

      <div className="theme-surface overflow-hidden rounded-[1.75rem] border p-1.5 shadow-[0_12px_32px_rgba(9,9,11,0.08)]">
        <div className="flex gap-1 overflow-hidden">
          <Skeleton className="h-12 w-44 shrink-0 rounded-[1.35rem] sm:h-14 xl:flex-1" />
          <Skeleton className="h-12 w-36 shrink-0 rounded-[1.35rem] sm:h-14 xl:flex-1" />
          <Skeleton className="h-12 w-32 shrink-0 rounded-[1.35rem] sm:h-14 xl:flex-1" />
          <Skeleton className="hidden h-12 w-32 shrink-0 rounded-[1.35rem] sm:h-14 md:block xl:flex-1" />
          <Skeleton className="hidden h-12 w-36 shrink-0 rounded-[1.35rem] sm:h-14 md:block xl:flex-1" />
        </div>
      </div>

      <SurfaceCard
        className="flex min-h-72 flex-col rounded-[2rem] shadow-[0_18px_48px_rgba(9,9,11,0.08)]"
        paddingClassName="p-6"
      >
        <Skeleton className="h-6 w-32" />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="rounded-3xl bg-zinc-50 p-5">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="mt-3 h-3 w-24" />
              <Skeleton className="mt-5 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-4/5" />
              <Skeleton className="mt-6 h-9 w-28 rounded-xl" />
            </div>
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}
