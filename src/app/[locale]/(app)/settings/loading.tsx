import { Skeleton } from "@/shared/ui/skeleton";
import { SurfaceCard } from "@/shared/ui/surface-card";

export default function SettingsLoading() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6">
      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr_1fr]">
        <div className="flex flex-col gap-4">
          <SurfaceCard className="h-48">
            <Skeleton className="mb-4 h-6 w-32" />
            <Skeleton className="h-12 w-full" />
          </SurfaceCard>
          <SurfaceCard className="h-32">
            <Skeleton className="mb-4 h-6 w-24" />
            <Skeleton className="h-10 w-full" />
          </SurfaceCard>
        </div>

        <SurfaceCard className="flex flex-col gap-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-12 w-full mt-auto" />
        </SurfaceCard>

        <SurfaceCard className="flex flex-col gap-4">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-12 w-full mt-auto" />
        </SurfaceCard>
      </div>
    </main>
  );
}
