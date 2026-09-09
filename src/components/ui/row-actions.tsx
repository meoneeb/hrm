"use client";

import { Pencil, Trash2, Eye, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type Action = {
  label: string;
  onClick: () => void;
  variant?: "edit" | "delete" | "view" | "default";
  disabled?: boolean;
};

export function RowActions({
  actions,
  className,
}: {
  actions: Action[];
  className?: string;
}) {
  if (actions.length === 0) {
    return (
      <div className={cn("flex items-center justify-end", className)}>
        <MoreHorizontal className="h-4 w-4 text-gray-600" />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-end", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-gray-400"
            aria-label="Actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {actions.map((a) => {
            const Icon =
              a.variant === "edit"
                ? Pencil
                : a.variant === "delete"
                  ? Trash2
                  : a.variant === "view"
                    ? Eye
                    : null;
            return (
              <DropdownMenuItem
                key={a.label}
                disabled={a.disabled}
                destructive={a.variant === "delete"}
                onSelect={() => a.onClick()}
              >
                {Icon ? <Icon className="h-4 w-4" /> : null}
                {a.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
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
    <Avatar className={className}>
      <AvatarFallback>{initials || "?"}</AvatarFallback>
    </Avatar>
  );
}
