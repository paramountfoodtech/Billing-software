import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { MaterialProcessingForm } from "@/components/material-processing-form"

export default async function NewProcessingEntryPage() {
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

  const [stockResult, processingResult] = await Promise.all([
    supabase
      .from("material_stock_entries")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .order("purchase_date", { ascending: false }),
    supabase
      .from("material_processing_entries")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .order("processing_date", { ascending: false }),
  ])

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Add New Processing Entry</h1>
        <p className="text-muted-foreground mt-1">Create a new material processing entry</p>
      </div>

      <div className="max-w-4xl">
        <MaterialProcessingForm
          stockEntries={(stockResult.data || []) as any}
          processingEntries={(processingResult.data || []) as any}
          userRole={profile.role}
        />
      </div>
    </div>
  )
}
