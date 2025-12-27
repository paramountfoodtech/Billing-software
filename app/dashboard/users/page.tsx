import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"
import { UsersTable } from "@/components/users-table"
import { Suspense } from "react"
import { LoadingOverlay } from "@/components/loading-overlay"

async function UsersContent({ userRole }: { userRole: string }) {
  const supabase = await createClient()

  const { data: users } = await supabase
    .from("profiles")
    .select("*, organizations(name)")
    .order("created_at", { ascending: false })

  return <UsersTable users={users || []} userRole={userRole} />
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
    <div className="lg:p-8">
      <div className="px-6 pb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">User Management</h1>
        <div className="flex items-center gap-2">
          {userRole === "super_admin" && (
            <Link href="/dashboard/users/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </Link>
          )}
        </div>
      </div>

      <Suspense fallback={<LoadingOverlay />}>
        <div className="px-6">
          <UsersContent userRole={userRole} />
        </div>
      </Suspense>
    </div>
  )
}
