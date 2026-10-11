"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Check, AlertCircle } from "lucide-react"

interface PriceCategory {
  id: string
  name: string
  description: string | null
  is_active?: boolean
}

interface MortalityTrackerConfig {
  id: string
  organization_id: string
  live_paper_category_id: string | null
}

interface MortalityTrackerConfigProps {
  config: MortalityTrackerConfig | null
  priceCategories: PriceCategory[]
  organizationId: string
}

export function MortalityTrackerConfig({
  config,
  priceCategories,
  organizationId,
}: MortalityTrackerConfigProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    config?.live_paper_category_id ?? null
  )
  const [isLoading, setIsLoading] = useState(false)

  const activeCategories = priceCategories.filter((c) => c.is_active !== false)
  const currentCategory = activeCategories.find((c) => c.id === selectedCategoryId)

  const handleSave = async () => {
    setIsLoading(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const payload = {
      organization_id: organizationId,
      live_paper_category_id: selectedCategoryId,
      created_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from("mortality_tracker_config")
      .upsert(payload, { onConflict: "organization_id" })

    if (error) {
      toast({ variant: "destructive", title: "Save failed", description: error.message })
    } else {
      toast({
        variant: "success",
        title: "Saved",
        description: `Live Paper Rate category set to "${currentCategory?.name ?? "None"}"`,
      })
      router.refresh()
    }
    setIsLoading(false)
  }

  return (
    <Card className="border border-slate-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Mortality Tracker — Live Paper Rate Category
          {config?.live_paper_category_id ? (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Configured</Badge>
          ) : (
            <Badge variant="outline" className="text-amber-600 border-amber-300">
              Not Configured
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Select which price category represents the <strong>Live Paper Rate</strong>. This rate will be
          used automatically in all Mortality Tracker calculations to compute the total value (KGs × rate of
          that day).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeCategories.length === 0 ? (
          <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 border border-amber-200 rounded px-3 py-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            No active price categories found. Create categories under Prices → Categories first.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* None option */}
            <button
              type="button"
              onClick={() => setSelectedCategoryId(null)}
              className={`relative flex flex-col items-start p-3 rounded-lg border-2 text-left transition-all
                ${selectedCategoryId === null
                  ? "border-slate-400 bg-slate-50"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
            >
              {selectedCategoryId === null && (
                <span className="absolute top-2 right-2">
                  <Check className="h-4 w-4 text-slate-600" />
                </span>
              )}
              <span className="text-sm font-medium text-slate-700">None</span>
              <span className="text-xs text-slate-400 mt-0.5">No rate applied</span>
            </button>

            {activeCategories.map((cat) => {
              const isSelected = selectedCategoryId === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`relative flex flex-col items-start p-3 rounded-lg border-2 text-left transition-all
                    ${isSelected
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50"
                    }`}
                >
                  {isSelected && (
                    <span className="absolute top-2 right-2">
                      <Check className="h-4 w-4 text-indigo-600" />
                    </span>
                  )}
                  <span className={`text-sm font-semibold ${isSelected ? "text-indigo-700" : "text-slate-800"}`}>
                    {cat.name}
                  </span>
                  {cat.description && (
                    <span className="text-xs text-slate-400 mt-0.5 line-clamp-2">{cat.description}</span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button
            onClick={handleSave}
            disabled={isLoading || activeCategories.length === 0}
            className="min-w-[120px]"
          >
            {isLoading ? <Spinner className="h-4 w-4" /> : "Save Configuration"}
          </Button>
          {currentCategory && (
            <p className="text-sm text-slate-500">
              Currently:{" "}
              <span className="font-medium text-slate-700">{currentCategory.name}</span>
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
