import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"
import { InvoicesTable } from "@/components/invoices-table"
import { InvoicesPageClient } from "./invoices-page-client"

export default async function InvoicesPage() {
  const supabase = await createClient()

  // Get all clients for selector
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .order("name", { ascending: true })

  const { data: invoices } = await supabase
    .from("invoices")
    .select(
      `
      *,
      clients(name, email),
      profiles!invoices_created_by_fkey(full_name)
    `,
    )
    .order("created_at", { ascending: false })

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground mt-1">Create and manage your invoices</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/invoices/new">
            <Plus className="h-4 w-4 mr-2" />
            Create Invoice
          </Link>
        </Button>
      </div>

      <InvoicesPageClient clients={clients || []} invoices={invoices || []} />
    </div>
  )
}
