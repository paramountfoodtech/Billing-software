"use client";

import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconTooltip } from "@/components/icon-tooltip";

type TableRowActionsProps = {
  children: React.ReactNode;
  align?: "start" | "center" | "end";
  label?: string;
};

export function TableRowActions({
  children,
  align = "end",
  label = "Actions",
}: TableRowActionsProps) {
  return (
    <DropdownMenu>
      <IconTooltip label={label}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            aria-label={label}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
      </IconTooltip>
      <DropdownMenuContent align={align} className="min-w-[10rem]">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
