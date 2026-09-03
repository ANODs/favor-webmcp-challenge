import { ProfileViewSkeleton } from "@/views/profile-view";

export default function ProfileLoading() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6">
      <ProfileViewSkeleton />
    </main>
  );
}
