import { createClient } from "@supabase/supabase-js"

export function createAdminClient() {
  // Use NEXT_PUBLIC_ prefix for Amplify SSR runtime compatibility
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceRoleKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY

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
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY,
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
