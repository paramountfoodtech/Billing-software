import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { ChallanForm } from "@/components/challan-form"
import { canEdit } from "@/lib/permissions"

export default async function EditChallanPage({
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
    .select("role")
    .eq("id", user.id)
    .single()

  if (!canEdit(profile?.role)) redirect("/dashboard")

  const { data: challan } = await supabase
    .from("challans")
    .select("*, challan_boxes(box_number, weight_kg, num_birds)")
    .eq("id", id)
    .single()

  if (!challan) notFound()

  if (challan.status !== "draft") {
    redirect("/dashboard/challans")
  }

  const { data: purchasers } = await supabase
    .from("purchasers")
    .select("id, name")
    .order("name")

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Edit purchase challan</h1>
        <p className="text-muted-foreground mt-1">Update draft purchase challan details</p>
      </div>

      <ChallanForm purchasers={purchasers || []} challan={challan} />
    </div>
  )
}
