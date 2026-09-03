import type { ReactNode } from "react";

type Item = {
  label: string;
  value: ReactNode;
};

type Props = {
  items: Item[];
  columnsClassName?: string;
};

export function MetricGrid({
  items,
  columnsClassName = "grid gap-4 md:grid-cols-2 xl:grid-cols-3",
}: Props) {
  return (
    <div className={columnsClassName}>
      {items.map((item) => (
        <div key={item.label} className="rounded-3xl border border-zinc-200 bg-transparent p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">{item.label}</p>
          <div className="mt-2 text-sm font-medium text-zinc-900">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

export function MetaGrid({
  items,
  columnsClassName = "grid gap-3 rounded-3xl border border-zinc-200 bg-transparent p-4 text-sm text-zinc-600 md:grid-cols-2",
}: Props) {
  return (
    <div className={columnsClassName}>
      {items.map((item) => (
        <div key={item.label}>
          <p className="text-xs uppercase tracking-wide text-zinc-500">{item.label}</p>
          <div className="mt-1 text-sm font-medium text-zinc-900">{item.value}</div>
        </div>
      ))}
    </div>
  );
}
