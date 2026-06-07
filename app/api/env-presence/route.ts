import { NextResponse } from "next/server"
import { requireSuperAdmin } from "@/lib/api-auth"

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const auth = await requireSuperAdmin()
  if (auth.error) return auth.error

  return NextResponse.json({
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY:
      !!process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_RESEND_API_KEY: !!process.env.NEXT_PUBLIC_RESEND_API_KEY,
    RESEND_API_KEY: !!process.env.RESEND_API_KEY,
    NEXT_PUBLIC_EMAIL_FROM: !!process.env.NEXT_PUBLIC_EMAIL_FROM,
    EMAIL_FROM: !!process.env.EMAIL_FROM,
    NEXT_PUBLIC_CRON_SECRET: !!process.env.NEXT_PUBLIC_CRON_SECRET,
    CRON_SECRET: !!process.env.CRON_SECRET,
    NEXT_PUBLIC_APP_URL: !!process.env.NEXT_PUBLIC_APP_URL,
  })
}
