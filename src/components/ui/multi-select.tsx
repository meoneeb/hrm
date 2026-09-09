"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type MultiSelectOption = {
  value: string;
  label: string;
};

type MultiSelectProps = {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
};

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  label,
  disabled,
  className,
  triggerClassName,
}: MultiSelectProps) {
  const selected = React.useMemo(() => new Set(value), [value]);

  const summary = React.useMemo(() => {
    if (value.length === 0) return null;
    if (value.length === 1) {
      return options.find((o) => o.value === value[0])?.label || value[0];
    }
    return `${value.length} selected`;
  }, [options, value]);

  function toggle(id: string, next: boolean) {
    if (next) onChange([...value, id]);
    else onChange(value.filter((v) => v !== id));
  }

  return (
    <div className={cn("w-full", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "h-8 w-full justify-between border-white/15 bg-background px-3 font-normal text-white hover:bg-zinc-800/80",
              !summary && "text-gray-500",
              triggerClassName
            )}
          >
            <span className="truncate">{summary || placeholder}</span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[12rem]"
          align="start"
        >
          {label ? <DropdownMenuLabel>{label}</DropdownMenuLabel> : null}
          {label ? <DropdownMenuSeparator /> : null}
          {options.length === 0 ? (
            <div className="px-2 py-1.5 text-sm text-gray-500">No options</div>
          ) : (
            options.map((opt) => (
              <DropdownMenuCheckboxItem
                key={opt.value}
                checked={selected.has(opt.value)}
                onCheckedChange={(checked) =>
                  toggle(opt.value, checked === true)
                }
                onSelect={(e) => e.preventDefault()}
              >
                {opt.label}
              </DropdownMenuCheckboxItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** Compact checklist for forms that prefer inline checkboxes over a menu. */
export function MultiSelectChecklist({
  options,
  value,
  onChange,
  className,
}: Omit<MultiSelectProps, "placeholder" | "label" | "triggerClassName">) {
  const selected = React.useMemo(() => new Set(value), [value]);

  return (
    <div className={cn("max-h-40 space-y-2 overflow-y-auto rounded-md border border-white/10 p-2", className)}>
      {options.map((opt) => {
        const checked = selected.has(opt.value);
        return (
          <label
            key={opt.value}
            className="flex cursor-pointer items-center gap-2 text-sm text-white"
          >
            <Checkbox
              checked={checked}
              onCheckedChange={(v) => {
                if (v === true) onChange([...value, opt.value]);
                else onChange(value.filter((x) => x !== opt.value));
              }}
            />
            {opt.label}
          </label>
        );
      })}
      {options.length === 0 ? (
        <p className="text-sm text-gray-500">No options</p>
      ) : null}
    </div>
  );
}
