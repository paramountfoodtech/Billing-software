"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

export async function createUser(formData: {
  email: string
  full_name: string
  role: string
  password: string
}) {
  const supabase = await createClient()

  // Get current user and verify they're admin
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single()

  if (adminProfile?.role !== "super_admin") {
    return { error: "Only super admins can create users" }
  }

  if (!adminProfile.organization_id) {
    return { error: "Admin must have an organization" }
  }

  try {
    // Use admin client to create user
    const adminClient = createAdminClient()

    // Create auth user
    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
      email: formData.email,
      password: formData.password,
      email_confirm: true,
      user_metadata: {
        full_name: formData.full_name,
        role: formData.role,
      },
    })

    if (authError) throw authError
    if (!authUser.user) throw new Error("User creation failed")

    // Create profile directly using admin client (bypasses RLS)
    const { error: profileError } = await adminClient.from("profiles").upsert({
      id: authUser.user.id,
      email: formData.email,
      full_name: formData.full_name,
      role: formData.role,
      is_active: true,
      organization_id: adminProfile.organization_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    if (profileError) throw profileError

    revalidatePath("/dashboard/users")
    return { success: true }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function updateUser(
  userId: string,
  formData: {
    full_name: string
    role: string
    is_active: boolean
  },
) {
  const supabase = await createClient()

  // Get current user and verify they're admin
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  if (adminProfile?.role !== "super_admin") {
    return { error: "Only super admins can update users" }
  }

  try {
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: formData.full_name,
        role: formData.role,
        is_active: formData.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)

    if (error) throw error

    revalidatePath("/dashboard/users")
    return { success: true }
  } catch (error: any) {
    return { error: error.message }
  }
}
