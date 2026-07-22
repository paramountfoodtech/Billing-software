import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"
import { UsersTable } from "@/components/users-table"
import { DashboardPageWrapper } from "@/components/dashboard-page-wrapper"
import { unstable_noStore as noStore } from "next/cache"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function UsersPage() {
  noStore()
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const [{ data: profile }, { data: users }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase
      .from("profiles")
      .select("*, organizations(name)")
      .order("created_at", { ascending: false }),
  ])

  if (!profile || (profile.role !== "super_admin" && profile.role !== "admin")) {
    redirect("/dashboard")
  }

  const userRole = profile.role

  return (
    <DashboardPageWrapper title="User Management">
      <div className="w-full p-4 sm:p-6 lg:p-8 space-y-4">
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3">
          {userRole === "super_admin" && (
            <Link href="/dashboard/users/new">
              <Button className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </Link>
          )}
        </div>

        <UsersTable users={users || []} userRole={userRole} />
      </div>
    </DashboardPageWrapper>
  )
}
