import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { PrintablePurchaseInvoice } from "@/components/printable-purchase-invoice"
import { Notes } from "@/components/notes"
import { EntryHistoryButton } from "@/components/entry-history-button"

export default async function PurchaseInvoiceDetailPage({
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

  const { data: invoice, error: invoiceError } = await supabase
    .from("purchase_invoices")
    .select(
      `
      *,
      purchasers(name, purchaser_code, email, phone, address, city, state, zip_code),
      profiles!purchase_invoices_created_by_fkey(full_name)
    `,
    )
    .eq("id", id)
    .maybeSingle()

  if (invoiceError || !invoice) notFound()

  const [linkedChallansResult, notesResult, profileResult] = await Promise.all([
    supabase
      .from("challans")
      .select(
        `
        id,
        challan_number,
        challan_date,
        num_boxes,
        total_birds,
        total_weight_kg,
        challan_boxes(box_number, weight_kg, num_birds)
      `,
      )
      .eq("purchase_invoice_id", id)
      .order("challan_number", { ascending: true }),
    supabase
      .from("purchase_invoice_notes")
      .select(
        `
          id,
          note,
          created_at,
          created_by,
          created_by_profile:profiles!created_by (full_name, role)
        `,
      )
      .eq("purchase_invoice_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("organization_id, role")
      .eq("id", user.id)
      .single(),
  ])

  let linkedChallans = linkedChallansResult.data || []

  // Legacy: only purchase_invoices.challan_id set
  if (linkedChallans.length === 0 && invoice.challan_id) {
    const { data: legacyChallan } = await supabase
      .from("challans")
      .select(
        `
        id,
        challan_number,
        challan_date,
        num_boxes,
        total_birds,
        total_weight_kg,
        challan_boxes(box_number, weight_kg, num_birds)
      `,
      )
      .eq("id", invoice.challan_id)
      .maybeSingle()
    if (legacyChallan) linkedChallans = [legacyChallan]
  }

  let template = null
  let liveCategoryId: string | null = null
  let priceHistory: Array<{
    price_category_id: string
    price: number
    effective_date: string
  }> = []

  if (profileResult.data?.organization_id) {
    const organizationId = profileResult.data.organization_id
    const [templateResult, categoriesResult, priceHistoryResult] =
      await Promise.all([
        supabase
          .from("invoice_templates")
          .select("*")
          .eq("organization_id", organizationId)
          .single(),
        supabase
          .from("price_categories")
          .select("id, name")
          .eq("organization_id", organizationId)
          .eq("is_active", true),
        supabase
          .from("price_category_history")
          .select("price_category_id, price, effective_date")
          .eq("organization_id", organizationId),
      ])

    template = templateResult.data
    liveCategoryId =
      (categoriesResult.data || []).find(
        (c) => c.name?.toLowerCase() === "live",
      )?.id ?? null
    priceHistory = priceHistoryResult.data || []
  }

  const invoiceNotes = (notesResult.data || [])
    .filter((note) => note.created_by_profile != null)
    .map((note) => {
      const profile = Array.isArray(note.created_by_profile)
        ? note.created_by_profile[0]
        : note.created_by_profile
      return {
        id: note.id as string,
        note: note.note as string,
        created_at: note.created_at as string,
        profiles: profile as { full_name: string; role: string },
      }
    })
    .filter((note) => note.profiles)

  const primary = linkedChallans[0] || null
  const allBoxes = linkedChallans.flatMap((c) =>
    (c.challan_boxes || []).map(
      (box: {
        box_number: number
        weight_kg: string
        num_birds?: number | null
      }) => ({
        ...box,
        challan_number: c.challan_number,
      }),
    ),
  )

  const invoiceForPrint = {
    ...invoice,
    linked_challans: linkedChallans.map((c) => ({
      challan_number: c.challan_number,
      challan_date: c.challan_date,
      num_boxes: c.num_boxes,
      total_birds: c.total_birds,
      total_weight_kg: c.total_weight_kg,
    })),
    challans: primary
      ? {
          challan_number: linkedChallans
            .map((c) => c.challan_number)
            .join(", "),
          challan_date: primary.challan_date,
          num_boxes: linkedChallans.reduce(
            (sum, c) => sum + Number(c.num_boxes || 0),
            0,
          ),
          total_birds: linkedChallans.reduce(
            (sum, c) => sum + Number(c.total_birds || 0),
            0,
          ),
          challan_boxes: allBoxes,
        }
      : null,
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-end">
        <EntryHistoryButton
          entityType="purchase_invoice"
          entityId={id}
          createdAt={invoice.created_at}
          createdByName={invoice.profiles?.full_name}
        />
      </div>
      <PrintablePurchaseInvoice
        invoice={invoiceForPrint}
        template={template}
        liveCategoryId={liveCategoryId}
        priceHistory={priceHistory}
      />
      <Notes
        notes={invoiceNotes}
        referenceId={id}
        referenceType="purchase_invoice"
        userRole={profileResult.data?.role}
      />
    </div>
  )
}
