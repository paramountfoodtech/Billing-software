"use client";

import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
    <Tooltip>
      <TooltipTrigger asChild>
        {/* span gives TooltipTrigger its own DOM node so it doesn't share
            an auto-generated Radix id with DropdownMenuTrigger, which
            would otherwise cause an SSR/client hydration mismatch */}
        <span className="inline-flex">
          <DropdownMenu>
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
            <DropdownMenuContent align={align} className="min-w-[10rem]">
              {children}
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
