import { createClient } from "@/lib/supabase/server"

import { PurchasePaymentForm } from "@/components/purchase-payment-form"



export default async function NewPurchasePaymentPage({

  searchParams,

}: {

  searchParams: Promise<{ invoice_id?: string; purchaser_id?: string }>

}) {

  const params = await searchParams

  const supabase = await createClient()



  const [{ data: purchasers }, { data: invoices }] = await Promise.all([

    supabase.from("purchasers").select("id, name").order("name"),

    supabase

      .from("purchase_invoices")

      .select(

        `

        id,

        invoice_number,

        total_amount,

        amount_paid,

        status,

        issue_date,

        purchaser_id,

        purchasers(name)

      `,

      )

      .neq("status", "paid")

      .neq("status", "cancelled")

      .order("invoice_number", { ascending: false }),

  ])



  return (

    <div className="p-6 lg:p-8">

      <div className="mb-6">

        <h1 className="text-3xl font-bold tracking-tight">Record Purchase Payment</h1>

        <p className="text-muted-foreground mt-1">

          Add a new payment record against a purchase invoice

        </p>

      </div>



      <div className="max-w-2xl">

        {!invoices || invoices.length === 0 ? (

          <div className="p-6 border rounded-lg bg-yellow-50 text-yellow-800">

            <p className="font-semibold">No purchase invoices available</p>

            <p className="text-sm mt-1">

              Generate a purchase invoice from a finalized challan first.

            </p>

          </div>

        ) : (

          <PurchasePaymentForm

            invoices={invoices}

            purchasers={purchasers || []}

            preSelectedInvoiceId={params.invoice_id}

            preSelectedPurchaserId={params.purchaser_id}

          />

        )}

      </div>

    </div>

  )

}

