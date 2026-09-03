import { DealCardSkeleton } from "@/widgets/deal-list";

export default function DealsLoading() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6">
      <div className="h-[52px] w-full rounded-2xl bg-zinc-100 dark:bg-white/5 animate-pulse" />
      <div className="grid gap-4">
        <DealCardSkeleton />
        <DealCardSkeleton />
        <DealCardSkeleton />
      </div>
    </main>
  );
}
