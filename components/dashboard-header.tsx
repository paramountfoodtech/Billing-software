"use client"

import { NotificationBell } from "@/components/notification-bell"
import { usePageTitleContext } from "@/app/dashboard/page-title-context"

interface DashboardHeaderProps {
  userId: string
}

export function DashboardHeader({ userId }: DashboardHeaderProps) {
  const { title } = usePageTitleContext()

  return (
    <header className="fixed top-0 left-0 right-0 z-30 h-16 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200 shadow-sm flex items-center justify-between px-4 md:px-6 lg:pl-64 lg:pr-6">
      <div className="flex items-center gap-4 flex-1 min-w-0 pl-2 md:pl-0">
        {title && <h1 className="text-xl md:text-2xl lg:text-3xl font-semibold text-slate-900 tracking-tight truncate">{title}</h1>}
      </div>
      <NotificationBell userId={userId} />
    </header>
  )
}
