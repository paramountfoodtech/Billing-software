import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { UserForm } from "@/components/user-form"

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Check if user is admin
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  if (profile?.role !== "super_admin") {
    redirect("/dashboard")
  }

  const { id } = await params

  // Get user data
  const { data: userData } = await supabase.from("profiles").select("*").eq("id", id).single()

  if (!userData) {
    redirect("/dashboard/users")
  }

  // Get organizations for dropdown
  const { data: organizations } = await supabase.from("organizations").select("*").order("name")

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Edit User</h1>
        <p className="text-slate-500 mt-1">Update user information and permissions</p>
      </div>

      <UserForm organizations={organizations || []} initialData={userData} />
    </div>
  )
}
