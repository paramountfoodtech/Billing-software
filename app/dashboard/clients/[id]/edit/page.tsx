import { createClient } from "@/lib/supabase/server"
import { ClientForm } from "@/components/client-form"
import { notFound, redirect } from "next/navigation"
import { canEdit } from "@/lib/permissions"
import { fetchUnlinkedPurchasers } from "@/lib/client-purchaser-link"

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single()

  if (!canEdit(profile?.role)) redirect("/dashboard")

  const { data: client } = await supabase.from("clients").select("*").eq("id", id).single()

  if (!client) {
    notFound()
  }

  let linkedPurchaserName: string | null = null
  if (client.linked_purchaser_id) {
    const { data: purchaser } = await supabase
      .from("purchasers")
      .select("name")
      .eq("id", client.linked_purchaser_id)
      .maybeSingle()
    linkedPurchaserName = purchaser?.name || null
  }

  const unlinkedPurchasers = profile?.organization_id
    ? await fetchUnlinkedPurchasers(supabase, profile.organization_id)
    : []

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Edit Client</h1>
        <p className="text-muted-foreground mt-1">Update client information</p>
      </div>

      <div className="max-w-2xl">
        <ClientForm
          client={client}
          linkedPurchaserName={linkedPurchaserName}
          unlinkedPurchasers={unlinkedPurchasers}
        />
      </div>
    </div>
  )
}
