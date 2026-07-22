"use client"

import type React from "react"
import { DashboardNav } from "@/components/dashboard-nav"
import { DashboardHeader } from "@/components/dashboard-header"
import { useSidebarContext } from "@/app/dashboard/sidebar-context"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"

interface Profile {
  id: string
  email: string
  full_name: string
  role: string
}

interface DashboardLayoutClientProps {
  profile: Profile | null
  children: React.ReactNode
}

export function DashboardLayoutClient({ profile, children }: DashboardLayoutClientProps) {
  const { isSidebarCollapsed } = useSidebarContext()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="flex min-h-screen bg-slate-50">
      <DashboardNav profile={profile} />
      <main 
        className={cn(
          "flex-1 flex flex-col bg-slate-50 transition-all duration-300 h-screen overflow-hidden",
          mounted && (!isSidebarCollapsed ? "lg:pl-64" : "lg:pl-20")
        )}
      >
        <DashboardHeader userId={profile?.id || ""} />
        <div className="flex-1 overflow-y-auto overflow-x-auto pt-16">
          {children}
        </div>
      </main>
    </div>
  )
}
