import { createClient } from "@/lib/supabase/server"

import { redirect } from "next/navigation"

import { ChallanForm } from "@/components/challan-form"

import { suggestNextNumber } from "@/lib/purchase-document-numbers"



export default async function NewChallanPage() {

  const supabase = await createClient()



  const {

    data: { user },

  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")



  const { data: profile } = await supabase

    .from("profiles")

    .select("organization_id")

    .eq("id", user.id)

    .single()



  if (!profile?.organization_id) redirect("/dashboard")



  const [{ data: purchasers }, { data: existing }] = await Promise.all([

    supabase

      .from("purchasers")

      .select("id, name")

      .eq("organization_id", profile.organization_id)

      .order("name"),

    supabase

      .from("challans")

      .select("challan_number")

      .eq("organization_id", profile.organization_id),

  ])



  const suggestedNumber = suggestNextNumber(

    "CH",

    (existing || []).map((c) => c.challan_number),

  )



  return (

    <div className="p-6 lg:p-8">

      <div className="mb-6">

        <h1 className="text-3xl font-bold tracking-tight">Create Challan</h1>

        <p className="text-muted-foreground mt-1">

          Record a new purchase challan with box weights

        </p>

      </div>



      <div className="max-w-3xl">

        <ChallanForm

          purchasers={purchasers || []}

          suggestedNumber={suggestedNumber}

        />

      </div>

    </div>

  )

}

