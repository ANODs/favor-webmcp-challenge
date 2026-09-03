import { Skeleton } from "@/shared/ui/skeleton";
import { SurfaceCard } from "@/shared/ui/surface-card";

export default function ContractsLoading() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-6 pb-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-4">
          <SurfaceCard paddingClassName="p-0" className="overflow-hidden rounded-[2rem]">
            <Skeleton className="h-[23rem] w-full rounded-none sm:h-[30rem]" />
          </SurfaceCard>
          <SurfaceCard className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/5" />
            </div>
            <Skeleton className="mt-2 h-14 w-full rounded-[1.75rem]" />
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-16 w-full rounded-2xl" />
          </SurfaceCard>
        </div>

        <SurfaceCard className="h-fit xl:sticky xl:top-6">
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-28 rounded-full" />
          </div>
          <Skeleton className="mt-4 h-9 w-4/5" />
          <Skeleton className="mt-6 h-28 w-full rounded-2xl" />
          <Skeleton className="mt-3 h-32 w-full rounded-2xl" />
          <Skeleton className="mt-6 h-36 w-full rounded-2xl" />
          <Skeleton className="mt-3 h-14 w-full rounded-full" />
          <div className="mt-5 flex gap-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-14" />
          </div>
        </SurfaceCard>
      </div>
    </main>
  );
}
