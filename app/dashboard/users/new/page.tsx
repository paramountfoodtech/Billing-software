import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { UserForm } from "@/components/user-form"

export default async function NewUserPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Check if user is admin
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  if (profile?.role !== "admin") {
    redirect("/dashboard")
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Create New User</h1>
        <p className="text-slate-500 mt-1">Add a new user (Admin, Manager, or Accountant)</p>
      </div>

      <UserForm organizations={[]} />
    </div>
  )
}
