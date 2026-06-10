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



  const hasChallan = Boolean(invoice.challan_id)

  const [challanResult, boxesResult, notesResult, profileResult] =

    await Promise.all([

      hasChallan

        ? supabase

            .from("challans")

            .select("challan_number, challan_date, num_boxes")

            .eq("id", invoice.challan_id)

            .maybeSingle()

        : Promise.resolve({ data: null, error: null }),

      hasChallan

        ? supabase

            .from("challan_boxes")

            .select("box_number, weight_kg, num_birds")

            .eq("challan_id", invoice.challan_id)

            .order("box_number", { ascending: true })

        : Promise.resolve({ data: [], error: null }),

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

      supabase.from("profiles").select("organization_id, role").eq("id", user.id).single(),

    ])



  if (hasChallan && !challanResult.data) notFound()



  let template = null

  if (profileResult.data?.organization_id) {

    const { data: templateData } = await supabase

      .from("invoice_templates")

      .select("*")

      .eq("organization_id", profileResult.data.organization_id)

      .single()

    template = templateData

  }



  const invoiceNotes =

    (notesResult.data || [])

      .filter((note: { created_by_profile: unknown }) => note.created_by_profile !== null)

      .map(

        (note: {

          id: string

          note: string

          created_at: string

          created_by_profile: { full_name: string; role: string }

        }) => ({

          id: note.id,

          note: note.note,

          created_at: note.created_at,

          profiles: note.created_by_profile,

        }),

      ) || []



  const invoiceForPrint = {

    ...invoice,

    challans: hasChallan && challanResult.data

      ? {

          ...challanResult.data,

          challan_boxes: boxesResult.data || [],

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

      <PrintablePurchaseInvoice invoice={invoiceForPrint} template={template} />

      <Notes

        notes={invoiceNotes}

        referenceId={id}

        referenceType="purchase_invoice"

        userRole={profileResult.data?.role}

      />

    </div>

  )

}

