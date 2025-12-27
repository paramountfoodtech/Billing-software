import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"
import { ProductsTable } from "@/components/products-table"
import { Suspense } from "react"
import { LoadingOverlay } from "@/components/loading-overlay"

async function ProductsContent() {
  const supabase = await createClient()

  const { data: products } = await supabase
    .from("products")
    .select("*, profiles!products_created_by_fkey(full_name)")
    .order("created_at", { ascending: false })

  return <ProductsTable products={products || []} />
}

export default async function ProductsPage() {
  return (
    <div className="lg:p-8">
      <div className="px-6 pb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Products & Services</h1>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link href="/dashboard/products/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Link>
          </Button>
        </div>
      </div>

        <Suspense fallback={<LoadingOverlay />}>
          <div className="px-6">
            <ProductsContent />
          </div>
        </Suspense>
    </div>
  )
}
