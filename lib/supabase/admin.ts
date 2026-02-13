import { createClient } from "@supabase/supabase-js"

export function createAdminClient() {
  // Prefer server-only env var names in production, fall back to NEXT_PUBLIC if present
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VERCEL_SUPABASE_SERVICE_ROLE_KEY

  // Better error message with debugging info (does not print secret values)
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    const missingVars = []
    if (!supabaseUrl) missingVars.push("NEXT_PUBLIC_SUPABASE_URL")
    if (!supabaseServiceRoleKey) missingVars.push("SUPABASE_SERVICE_ROLE_KEY")

    const errorMsg = `Missing Supabase environment variables: ${missingVars.join(", ")}`
    console.error(errorMsg)
    console.error("Node env:", process.env.NODE_ENV)
    console.error("Available env keys (filtered):", Object.keys(process.env).filter(k => k.toUpperCase().includes("SUPABASE")))
    console.error("Env presence (booleans):", {
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    })

    throw new Error(errorMsg)
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
