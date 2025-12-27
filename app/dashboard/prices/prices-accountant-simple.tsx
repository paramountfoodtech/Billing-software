"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"

interface Props {
  organizationId: string
}

export default function PricesAccountantSimple({ organizationId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const today = new Date().toISOString().split("T")[0]
  const [date, setDate] = useState<string>(today)
  const [checking, setChecking] = useState(false)
  const [existsCount, setExistsCount] = useState<number>(0)

  useEffect(() => {
    const check = async () => {
      setChecking(true)
      const { count } = await supabase
        .from("price_category_history")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("effective_date", date)
      setExistsCount(count ?? 0)
      setChecking(false)
    }
    check()
  }, [date, organizationId, supabase])

  const goToUpdate = () => {
    router.push(`/dashboard/prices/new?date=${date}`)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1">Select Date</label>
            <Input
              type="date"
              value={date}
              max={today}
              onChange={(e) => {
                const val = e.target.value
                setDate(val > today ? today : val)
              }}
            />
          </div>

          <div className="text-sm text-muted-foreground">
            {checking ? (
              <div className="flex items-center gap-2"><Spinner className="h-4 w-4" /> Checking prices…</div>
            ) : existsCount > 0 ? (
              <span>Prices are already set for the selected date.</span>
            ) : (
              <span>No prices found for the selected date.</span>
            )}
          </div>

          <div>
            <Button onClick={goToUpdate} disabled={checking || existsCount > 0}>
              Update Prices
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
