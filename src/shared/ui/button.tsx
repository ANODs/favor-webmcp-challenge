import React from "react";
import { Link } from "@/i18n/routing";
import { cn } from "@/shared/lib/cn";
import { Loader2 } from "lucide-react";

export type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "xl" | "xxl";
export type ButtonShape = "rounded-xl" | "rounded-2xl" | "rounded-3xl" | "rounded-full";

interface BaseButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
}

// Props for when the button acts as an HTML <button>
type HTMLButtonProps = BaseButtonProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof BaseButtonProps> & {
    href?: undefined;
  };

// Props for when the button acts as a Link
type LinkButtonProps = BaseButtonProps &
  Omit<React.ComponentPropsWithoutRef<typeof Link>, keyof BaseButtonProps> & {
    href: string;
  };

export type ButtonProps = HTMLButtonProps | LinkButtonProps;

export const Button = React.forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      shape = "rounded-2xl",
      fullWidth = false,
      loading = false,
      disabled,
      className,
      children,
      href,
      ...props
    },
    ref
  ) => {
    const baseStyles = cn(
      "inline-flex items-center justify-center font-medium transition-all duration-200 select-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
    );

    const variants: Record<ButtonVariant, string> = {
      primary:
        "bg-zinc-950 text-white hover:bg-zinc-800 shadow-sm active:bg-zinc-900 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 dark:active:bg-zinc-200",
      accent:
        "bg-brand-accent text-black shadow-[0_10px_28px_rgba(36,160,80,0.2)] hover:brightness-95 active:brightness-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] dark:shadow-[0_10px_32px_rgba(117,247,96,0.16)] dark:focus-visible:ring-brand-accent",
      secondary:
        "border border-zinc-200 bg-transparent text-zinc-900 hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-950 dark:active:bg-zinc-900",
      ghost:
        "bg-transparent text-zinc-700 hover:bg-zinc-100 active:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:active:bg-zinc-800",
      danger:
        "bg-red-50 border border-red-100 text-red-700 hover:bg-red-100 active:bg-red-200 dark:bg-red-950/20 dark:border-red-950/30 dark:text-red-400 dark:hover:bg-red-950/30 dark:active:bg-red-950/40",
    };

    const sizes: Record<ButtonSize, string> = {
      sm: "px-3.5 py-2 text-xs font-semibold tracking-wide",
      md: "px-5 py-3 text-sm font-semibold",
      lg: "px-6 py-3.5 text-sm font-semibold",
      xl: "px-6 py-4 text-[15px] font-semibold",
      xxl: "px-8 py-5 text-[15px] font-semibold",
    };

    const shapes: Record<ButtonShape, string> = {
      "rounded-xl": "rounded-xl",
      "rounded-2xl": "rounded-2xl",
      "rounded-3xl": "rounded-3xl",
      "rounded-full": "rounded-full",
    };

    const widthStyle = fullWidth ? "w-full" : "";
    const isDisabled = disabled || loading;

    const buttonClass = cn(
      baseStyles,
      variants[variant],
      sizes[size],
      shapes[shape],
      widthStyle,
      className
    );

    const content = (
      <>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" />}
        <span className={cn("flex items-center justify-center gap-2", loading && "opacity-80")}>
          {children}
        </span>
      </>
    );

    if (href !== undefined) {
      const linkProps = props as Omit<React.ComponentPropsWithoutRef<typeof Link>, "href">;
      return (
        <Link
          className={buttonClass}
          ref={ref as React.ForwardedRef<HTMLAnchorElement>}
          {...linkProps}
          href={href}
        >
          {content}
        </Link>
      );
    }

    const buttonProps = props as React.ButtonHTMLAttributes<HTMLButtonElement>;
    return (
      <button
        type={buttonProps.type || "button"}
        disabled={isDisabled}
        className={buttonClass}
        ref={ref as React.ForwardedRef<HTMLButtonElement>}
        {...buttonProps}
      >
        {content}
      </button>
    );
  }
);

Button.displayName = "Button";
