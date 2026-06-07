import type React from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardNav } from "@/components/dashboard-nav"
import { PageTitleProvider } from "@/app/dashboard/page-title-context"
import { SidebarProvider } from "@/app/dashboard/sidebar-context"
import { DashboardHeader } from "@/components/dashboard-header"
import { DashboardLayoutClient } from "@/app/dashboard/layout-client"
import { Suspense } from "react"

// Prevent caching of dashboard pages to ensure auth check on every request
export const revalidate = 0

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth/login")
  }

  let { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, organization_id, is_active")
    .eq("id", user.id)
    .maybeSingle()

  // If profile doesn't exist, create one with default role
  if (!profile && !error) {
    const { data: newProfile } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        email: user.email || "",
        full_name: user.user_metadata?.full_name || "User",
        role: "accountant",
      })
      .select("id, email, full_name, role, organization_id, is_active")
      .single()

    profile = newProfile
  }

  if (profile?.is_active === false) {
    await supabase.auth.signOut()
    redirect("/auth/login")
  }

  return (
    <PageTitleProvider>
      <SidebarProvider>
        <DashboardLayoutClient profile={profile}>
          {children}
        </DashboardLayoutClient>
      </SidebarProvider>
    </PageTitleProvider>
  )
}
