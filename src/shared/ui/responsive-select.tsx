"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import { liquidGlassFieldClassName, liquidGlassMenuClassName } from "./liquid-glass";

type SelectOption<TValue extends string> = {
  value: TValue;
  label: string;
};

type Props<TValue extends string> = {
  value: TValue;
  options: SelectOption<TValue>[];
  onChange: (value: TValue) => void;
  className?: string;
  controlClassName?: string;
  menuClassName?: string;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
};

const baseControlClassName = liquidGlassFieldClassName;

export function ResponsiveSelect<TValue extends string>({
  value,
  options,
  onChange,
  className = "",
  controlClassName = "",
  menuClassName = "",
  placeholder,
  disabled = false,
  ariaLabel,
}: Props<TValue>) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.value === value);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className={`relative w-full ${className}`}>
      <div className="md:hidden">
        <div className="relative">
          <select
            value={value}
            onChange={(event) => onChange(event.target.value as TValue)}
            disabled={disabled}
            aria-label={ariaLabel}
            className={`${baseControlClassName} appearance-none pr-11 disabled:cursor-not-allowed disabled:opacity-60 ${controlClassName}`}
          >
            {!selectedOption && placeholder && (
              <option value="" disabled hidden>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        </div>
      </div>

      <div className="hidden md:block">
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          disabled={disabled}
          aria-label={ariaLabel}
          className={`${baseControlClassName} inline-flex items-center justify-between gap-3 disabled:cursor-not-allowed disabled:opacity-60 ${controlClassName}`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className={`truncate ${!selectedOption && placeholder ? "text-zinc-500" : ""}`}>
            {selectedOption?.label ?? placeholder ?? ""}
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition ${
              isOpen ? "rotate-180 text-zinc-900 dark:text-zinc-100" : "text-zinc-500"
            }`}
          />
        </button>

        {isOpen ? (
          <div
            className={`absolute top-[calc(100%+0.5rem)] left-0 z-30 w-full ${liquidGlassMenuClassName} ${menuClassName}`}
          >
            <div className="grid gap-1 p-2">
              {options.map((option) => {
                const isSelected = option.value === value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                      isSelected
                        ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
                        : "text-zinc-800 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-white/10"
                    }`}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <span className="truncate">{option.label}</span>
                    {isSelected ? <Check className="h-4 w-4 shrink-0" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
