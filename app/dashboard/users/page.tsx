import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"
import { UsersTable } from "@/components/users-table"
import { DashboardPageWrapper } from "@/components/dashboard-page-wrapper"
import { Suspense } from "react"
import { LoadingOverlay } from "@/components/loading-overlay"
import { unstable_noStore as noStore } from 'next/cache'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function UsersContent({ userRole }: { userRole: string }) {
  noStore()
  const supabase = await createClient()

  const { data: users } = await supabase
    .from("profiles")
    .select("*, organizations(name)")
    .order("created_at", { ascending: false })

  console.log('Users fetched:', users?.map(u => ({ email: u.email, is_active: u.is_active })))

  return <UsersTable key={Date.now()} users={users || []} userRole={userRole} />
}

export default async function UsersPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Check role (super_admin full, admin view-only)
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  if (!profile || (profile.role !== "super_admin" && profile.role !== "admin")) {
    redirect("/dashboard")
  }

  const userRole = profile.role

  return (
    <DashboardPageWrapper title="User Management">
      <div className="w-full p-4 sm:p-6 lg:p-8 space-y-4">
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
          {userRole === "super_admin" && (
            <Link href="/dashboard/users/new">
              <Button className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </Link>
          )}
        </div>

        <Suspense fallback={<LoadingOverlay />}>
          <UsersContent userRole={userRole} />
        </Suspense>
      </div>
    </DashboardPageWrapper>
  )
}
