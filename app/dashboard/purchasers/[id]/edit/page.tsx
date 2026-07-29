import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { PurchaserForm } from "@/components/purchaser-form"
import { canEdit } from "@/lib/permissions"
import { fetchUnlinkedClients } from "@/lib/client-purchaser-link"

export default async function EditPurchaserPage({
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
    .select("role, organization_id")
    .eq("id", user.id)
    .single()

  if (!canEdit(profile?.role)) redirect("/dashboard")

  const { data: purchaser } = await supabase
    .from("purchasers")
    .select("*")
    .eq("id", id)
    .single()

  if (!purchaser) notFound()

  let linkedClientName: string | null = null
  if (purchaser.linked_client_id) {
    const { data: client } = await supabase
      .from("clients")
      .select("name")
      .eq("id", purchaser.linked_client_id)
      .maybeSingle()
    linkedClientName = client?.name || null
  }

  const unlinkedClients = profile?.organization_id
    ? await fetchUnlinkedClients(supabase, profile.organization_id)
    : []

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Edit Purchaser</h1>
        <p className="text-muted-foreground mt-1">Update purchaser information</p>
      </div>

      <div className="max-w-2xl">
        <PurchaserForm
          purchaser={purchaser}
          linkedClientName={linkedClientName}
          unlinkedClients={unlinkedClients}
        />
      </div>
    </div>
  )
}
