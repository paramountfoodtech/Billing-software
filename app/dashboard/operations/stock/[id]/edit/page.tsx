import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { MaterialStockForm } from "@/components/material-stock-form"

export default async function EditStockEntryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
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

  if (profile?.role === "accountant") redirect("/dashboard")

  const { data: entry } = await supabase
    .from("material_stock_entries")
    .select("*")
    .eq("id", id)
    .single()

  if (!entry) notFound()

  const { data: allEntries } = await supabase
    .from("material_stock_entries")
    .select("reference_number")
    .eq("organization_id", entry.organization_id)

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Edit Stock Entry</h1>
        <p className="text-muted-foreground mt-1">Update stock entry information</p>
      </div>

      <div className="max-w-2xl">
        <MaterialStockForm
          entries={(allEntries || []) as any}
          selectedEntry={entry as any}
          userRole={profile?.role || "admin"}
        />
      </div>
    </div>
  )
}
