"use client"

import { usePageTitleContext } from "@/app/dashboard/page-title-context"
import { useSidebarContext } from "@/app/dashboard/sidebar-context"
import { NotificationBell } from "@/components/notification-bell"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"

interface DashboardHeaderProps {
  userId: string
}

export function DashboardHeader({ userId }: DashboardHeaderProps) {
  const { title } = usePageTitleContext()
  const { isSidebarCollapsed } = useSidebarContext()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <header 
      className={cn(
        "fixed top-0 left-0 right-0 z-30 h-16 bg-white border-b border-slate-200 shadow-sm flex items-center justify-between px-4 sm:px-6 transition-all duration-300",
        mounted && (!isSidebarCollapsed ? "lg:pl-64" : "lg:pl-20")
      )}
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {title && <h1 className="text-lg sm:text-xl md:text-2xl font-semibold text-slate-900 tracking-tight truncate">{title}</h1>}
      </div>
      <div className="flex-shrink-0">
        <NotificationBell userId={userId} />
      </div>
    </header>
  )
}
