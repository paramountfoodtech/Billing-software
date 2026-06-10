import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"
import { ChallansTable } from "@/components/challans-table"
import { DashboardPageWrapper } from "@/components/dashboard-page-wrapper"
import { Suspense } from "react"
import { LoadingOverlay } from "@/components/loading-overlay"
async function ChallansContent() {
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

  return <ChallansTable challans={challans || []} />
}

export default async function ChallansPage() {
  return (
    <DashboardPageWrapper title="Challans">
      <div className="w-full p-4 sm:p-6 lg:p-8 space-y-4">
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3">
          <Button asChild className="w-full sm:w-auto">
            <Link href="/dashboard/challans/new">
              <Plus className="h-4 w-4 mr-2" />
              New Challan
            </Link>
          </Button>
        </div>

        <Suspense fallback={<LoadingOverlay />}>
          <ChallansContent />
        </Suspense>
      </div>
    </DashboardPageWrapper>
  )
}
