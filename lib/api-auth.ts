import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function requireSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "super_admin" || !profile.organization_id) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { supabase, user, profile };
}

export async function verifyUserInOrganization(
  targetUserId: string,
  organizationId: string,
) {
  const admin = createAdminClient();
  const { data: target } = await admin
    .from("profiles")
    .select("organization_id")
    .eq("id", targetUserId)
    .maybeSingle();

  return target?.organization_id === organizationId;
}

export function verifyInternalSecret(request: Request) {
  const secret =
    process.env.INTERNAL_API_SECRET ||
    process.env.CRON_SECRET ||
    process.env.NEXT_PUBLIC_CRON_SECRET ||
    "your-secret-key";

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}
