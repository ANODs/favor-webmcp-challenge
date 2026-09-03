import { Skeleton } from "@/shared/ui/skeleton";
import { SurfaceCard } from "@/shared/ui/surface-card";

export function ProfileSectionContentSkeleton() {
  return (
    <SurfaceCard className="min-h-72 rounded-[2rem]" paddingClassName="p-6" aria-hidden="true">
      <Skeleton className="h-6 w-36" />
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Skeleton className="h-32 w-full rounded-3xl" />
        <Skeleton className="h-32 w-full rounded-3xl" />
      </div>
    </SurfaceCard>
  );
}
