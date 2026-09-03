type Props = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: Props) {
  return (
    <div className="rounded-3xl border border-dashed border-zinc-200 bg-zinc-50 px-5 py-8 text-center">
      <h3 className="text-base font-semibold text-zinc-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
    </div>
  );
}
