import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { MaterialStockForm } from "@/components/material-stock-form"

export default async function NewStockEntryPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single()

  if (!profile?.organization_id || profile.role === "accountant") {
    redirect("/dashboard")
  }

  const { data: existingEntries } = await supabase
    .from("material_stock_entries")
    .select("reference_number")
    .eq("organization_id", profile.organization_id)
    .order("created_at", { ascending: false })

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Add New Stock Entry</h1>
        <p className="text-muted-foreground mt-1">Create a new material stock entry</p>
      </div>

      <div className="max-w-2xl">
        <MaterialStockForm
          entries={(existingEntries || []) as any}
          userRole={profile.role}
        />
      </div>
    </div>
  )
}
