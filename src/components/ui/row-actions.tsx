"use client";

import { Pencil, Trash2, Eye, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Action = {
  label: string;
  onClick: () => void;
  variant?: "edit" | "delete" | "view" | "default";
  disabled?: boolean;
};

export function RowActions({ actions, className }: { actions: Action[]; className?: string }) {
  return (
    <div className={cn("flex items-center justify-end gap-1", className)}>
      {actions.map((a) => {
        if (a.variant === "edit") {
          return (
            <Button
              key={a.label}
              type="button"
              size="icon"
              variant="ghost"
              title={a.label}
              disabled={a.disabled}
              onClick={a.onClick}
              className="h-8 w-8 text-gray-400 hover:text-teal-400"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          );
        }
        if (a.variant === "delete") {
          return (
            <Button
              key={a.label}
              type="button"
              size="icon"
              variant="ghost"
              title={a.label}
              disabled={a.disabled}
              onClick={a.onClick}
              className="h-8 w-8 text-gray-400 hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          );
        }
        if (a.variant === "view") {
          return (
            <Button
              key={a.label}
              type="button"
              size="sm"
              variant="ghost"
              title={a.label}
              disabled={a.disabled}
              onClick={a.onClick}
              className="text-teal-400"
            >
              <Eye className="h-4 w-4" />
              {a.label}
            </Button>
          );
        }
        return (
          <Button
            key={a.label}
            type="button"
            size="sm"
            variant="outline"
            disabled={a.disabled}
            onClick={a.onClick}
          >
            {a.label}
          </Button>
        );
      })}
      {actions.length === 0 ? (
        <MoreHorizontal className="h-4 w-4 text-gray-600" />
      ) : null}
    </div>
  );
}

export function InitialsAvatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const parts = name.trim().split(/\s+/);
  const initials = (
    (parts[0]?.[0] || "") + (parts[1]?.[0] || parts[0]?.[1] || "")
  ).toUpperCase();
  return (
    <div
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-500/20 text-xs font-semibold text-teal-400",
        className
      )}
    >
      {initials || "?"}
    </div>
  );
}
