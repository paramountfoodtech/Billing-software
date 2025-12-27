import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"
import { ClientsTable } from "@/components/clients-table"
import { Suspense } from "react"
import { LoadingOverlay } from "@/components/loading-overlay"

async function ClientsContent() {
  const supabase = await createClient()

  const { data: clients } = await supabase
    .from("clients")
    .select("*, profiles!clients_created_by_fkey(full_name)")
    .order("created_at", { ascending: false })

  return <ClientsTable clients={clients || []} />
}

export default async function ClientsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id || "")
    .single()

  const userRole = profile?.role || "accountant"

  return (
    <div className="lg:p-8">
      <div className="px-6 pb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Clients</h1>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link href="/dashboard/clients/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Client
            </Link>
          </Button>
        </div>
      </div>

        <Suspense fallback={<LoadingOverlay />}>
          <div className="px-6">
            <ClientsContent />
          </div>
        </Suspense>
    </div>
  )
}
