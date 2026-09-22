import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ClientsTable } from "@/components/clients-table"
import { DashboardPageWrapper } from "@/components/dashboard-page-wrapper"

export default async function ClientsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || (profile.role !== "super_admin" && profile.role !== "admin")) {
    redirect("/dashboard")
  }

  const { data: clients } = await supabase
    .from("clients")
    .select("*, profiles!clients_created_by_fkey(full_name)")
    .order("created_at", { ascending: false })

  const userRole = profile.role

  return (
    <DashboardPageWrapper title="Clients">
      <div className="w-full p-4 sm:p-6 lg:p-8 space-y-4">
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3">
          <Button asChild className="w-full sm:w-auto">
            <Link href="/dashboard/clients/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Client
            </Link>
          </Button>
        </div>

        <ClientsTable clients={clients || []} userRole={userRole} />
      </div>
    </DashboardPageWrapper>
  )
}
