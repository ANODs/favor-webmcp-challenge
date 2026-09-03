import type { ReactNode } from "react";

type Props = React.HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  className?: string;
  paddingClassName?: string;
};

export function SurfaceCard({
  children,
  className = "",
  paddingClassName = "p-6",
  ...props
}: Props) {
  return (
    <section {...props} className={`theme-surface rounded-3xl border ${paddingClassName} ${className}`}>
      {children}
    </section>
  );
}
