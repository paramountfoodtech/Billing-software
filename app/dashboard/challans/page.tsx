import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"
import { ChallansTable } from "@/components/challans-table"
import { DashboardPageWrapper } from "@/components/dashboard-page-wrapper"
import { Suspense } from "react"
import { LoadingOverlay } from "@/components/loading-overlay"
import { redirect } from "next/navigation"

async function ChallansContent({ userRole }: { userRole?: string }) {
  const supabase = await createClient()

  const { data: challans } = await supabase
    .from("challans")
    .select(
      `
      *,
      purchasers(name, purchaser_code),
      profiles!challans_created_by_fkey(full_name)
    `,
    )
    .order("created_at", { ascending: false })

  return <ChallansTable challans={challans || []} userRole={userRole} />
}

export default async function ChallansPage() {
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

  const userRole = profile?.role

  return (
    <DashboardPageWrapper title="Purchase challans">
      <div className="w-full p-4 sm:p-6 lg:p-8 space-y-4">
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3">
          <Button asChild className="w-full sm:w-auto">
            <Link href="/dashboard/challans/new">
              <Plus className="h-4 w-4 mr-2" />
              New purchase challan
            </Link>
          </Button>
        </div>

        <Suspense fallback={<LoadingOverlay />}>
          <ChallansContent userRole={userRole} />
        </Suspense>
      </div>
    </DashboardPageWrapper>
  )
}
