import { createClient } from "@/lib/supabase/server"

import { redirect, notFound } from "next/navigation"

import { PurchaserForm } from "@/components/purchaser-form"



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

    .select("role")

    .eq("id", user.id)

    .single()



  if (profile?.role === "accountant") redirect("/dashboard")



  const { data: purchaser } = await supabase

    .from("purchasers")

    .select("*")

    .eq("id", id)

    .single()



  if (!purchaser) notFound()



  return (

    <div className="p-6 lg:p-8">

      <div className="mb-6">

        <h1 className="text-3xl font-bold tracking-tight">Edit Purchaser</h1>

        <p className="text-muted-foreground mt-1">Update purchaser information</p>

      </div>



      <div className="max-w-2xl">

        <PurchaserForm purchaser={purchaser} />

      </div>

    </div>

  )

}

