"use client"

import type React from "react"
import { DashboardNav } from "@/components/dashboard-nav"
import { DashboardHeader } from "@/components/dashboard-header"
import { useSidebarContext } from "@/app/dashboard/sidebar-context"
import { cn } from "@/lib/utils"
import { Suspense, useEffect, useState } from "react"

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
          "flex-1 flex flex-col bg-slate-50 transition-all duration-300",
          mounted && (!isSidebarCollapsed ? "lg:pl-64" : "lg:pl-20")
        )}
      >
        <DashboardHeader userId={profile?.id || ""} />
        <div className="flex-1 overflow-auto pt-16">
          <Suspense 
            fallback={
              <div className="w-full h-full bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100" 
                style={{
                  animation: 'shimmerContent 2s infinite',
                  backgroundSize: '200% 100%'
                }}
              />
            }
          >
            {children}
          </Suspense>
        </div>
      </main>
    </div>
  )
}
