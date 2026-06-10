import { createClient } from "@/lib/supabase/server"

import { redirect } from "next/navigation"

import { PurchaserForm } from "@/components/purchaser-form"

import { suggestPurchaserCode } from "@/lib/purchase-document-numbers"



export default async function NewPurchaserPage() {

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



  const { data: existing } = await supabase

    .from("purchasers")

    .select("purchaser_code")

    .eq("organization_id", profile.organization_id)



  const suggestedCode = suggestPurchaserCode(

    (existing || []).map((p) => p.purchaser_code),

  )



  return (

    <div className="p-6 lg:p-8">

      <div className="mb-6">

        <h1 className="text-3xl font-bold tracking-tight">Add New Purchaser</h1>

        <p className="text-muted-foreground mt-1">Create a new purchaser record</p>

      </div>



      <div className="max-w-2xl">

        <PurchaserForm suggestedCode={suggestedCode} />

      </div>

    </div>

  )

}

