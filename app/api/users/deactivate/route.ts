import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  requireSuperAdmin,
  verifyUserInOrganization,
} from "@/lib/api-auth"

export async function POST(request: Request) {
  try {
    const auth = await requireSuperAdmin()
    if (auth.error) return auth.error

    const { id } = await request.json()

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Missing or invalid 'id'" }, { status: 400 })
    }

    if (id === auth.user.id) {
      return NextResponse.json(
        { error: "You cannot deactivate your own account" },
        { status: 400 },
      )
    }

    const inOrg = await verifyUserInOrganization(
      id,
      auth.profile.organization_id,
    )
    if (!inOrg) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const admin = createAdminClient()
    const { error: banError } = await admin.auth.admin.updateUserById(id, {
      ban_duration: "876000h",
    } as any)

    if (banError) {
      return NextResponse.json({ error: banError.message }, { status: 500 })
    }

    const { error: profileError } = await admin
      .from("profiles")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id)

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
