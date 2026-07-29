import { createClient } from "@/lib/supabase/server"
import { ClientForm } from "@/components/client-form"
import { redirect } from "next/navigation"
import { fetchUnlinkedPurchasers } from "@/lib/client-purchaser-link"
import { canCreate } from "@/lib/permissions"

export default async function NewClientPage() {
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

  if (!canCreate(profile?.role)) {
    redirect("/dashboard")
  }

  const unlinkedPurchasers = profile?.organization_id
    ? await fetchUnlinkedPurchasers(supabase, profile.organization_id)
    : []

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Add New Client</h1>
        <p className="text-muted-foreground mt-1">Create a new client record</p>
      </div>

      <div className="max-w-2xl">
        <ClientForm unlinkedPurchasers={unlinkedPurchasers} />
      </div>
    </div>
  )
}
