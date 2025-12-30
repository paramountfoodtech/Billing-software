"use client"

import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface ResponsiveTableProps {
  children: ReactNode
  className?: string
}

export function ResponsiveTableWrapper({ children, className }: ResponsiveTableProps) {
  return (
    <div className={cn(
      "rounded-lg border bg-white overflow-x-auto",
      "shadow-sm",
      className
    )}>
      {children}
    </div>
  )
}

// Helper to hide columns on mobile
export function HideOnMobile({ className }: { className?: string }) {
  return cn("hidden sm:table-cell", className)
}

export function ShowOnMobileOnly({ className }: { className?: string }) {
  return cn("sm:hidden", className)
}
