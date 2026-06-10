import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { PrintableChallan } from "@/components/printable-challan"
import { EntryHistoryButton } from "@/components/entry-history-button"

export default async function ChallanDetailPage({
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

  const { data: challan, error } = await supabase
    .from("challans")
    .select(
      `
      *,
      purchasers(name, purchaser_code, email, phone, address, city, state, zip_code),
      profiles!challans_created_by_fkey(full_name)
    `,
    )
    .eq("id", id)
    .maybeSingle()

  if (error || !challan) notFound()

  if (challan.status === "invoiced" && challan.purchase_invoice_id) {
    redirect(`/dashboard/purchase-invoices/${challan.purchase_invoice_id}`)
  }

  const { data: boxes } = await supabase
    .from("challan_boxes")
    .select("box_number, weight_kg, num_birds")
    .eq("challan_id", id)
    .order("box_number", { ascending: true })

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single()

  let template = null
  if (profile?.organization_id) {
    const { data: templateData } = await supabase
      .from("invoice_templates")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .single()
    template = templateData
  }

  const challanForPrint = {
    ...challan,
    challan_boxes: boxes || [],
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-end">
        <EntryHistoryButton
          entityType="challan"
          entityId={id}
          createdAt={challan.created_at}
          createdByName={challan.profiles?.full_name}
        />
      </div>
      <PrintableChallan challan={challanForPrint} template={template} />
    </div>
  )
}
