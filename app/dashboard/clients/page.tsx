import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"
import { ClientsTable } from "@/components/clients-table"

export default async function ClientsPage() {
  const supabase = await createClient()

  // Get user profile for role-based UI
  const {
    data: { user },
  } = await supabase.auth.getUser()
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id || "")
    .single()

  const { data: clients } = await supabase
    .from("clients")
    .select("*, profiles!clients_created_by_fkey(full_name)")
    .order("created_at", { ascending: false })

  const userRole = profile?.role || "accountant"

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground mt-1">Manage your client information</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/clients/new">
            <Plus className="h-4 w-4 mr-2" />
            Add Client
          </Link>
        </Button>
      </div>

  <ClientsTable clients={clients || []} />
    </div>
  )
}
