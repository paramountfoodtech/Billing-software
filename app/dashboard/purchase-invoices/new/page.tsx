import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  PurchaseInvoiceForm,
  type PurchaseInvoiceEntryType,
} from "@/components/purchase-invoice-form";
import { suggestNextNumber } from "@/lib/purchase-document-numbers";

export default async function NewPurchaseInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ challan_id?: string; type?: string }>;
}) {
  const { challan_id: challanId, type } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!profile?.organization_id) redirect("/dashboard");

  const organizationId = profile.organization_id;

  const [purchasersResult, challansResult, invoicesResult] = await Promise.all([
    supabase
      .from("purchasers")
      .select("id, name, purchaser_code")
      .eq("organization_id", organizationId)
      .order("name"),
    supabase
      .from("challans")
      .select(
        `
        id,
        challan_number,
        purchaser_id,
        total_weight_kg,
        status,
        purchasers(name)
      `,
      )
      .eq("organization_id", organizationId)
      .eq("status", "final")
      .order("challan_date", { ascending: false }),
    supabase
      .from("purchase_invoices")
      .select("invoice_number")
      .eq("organization_id", organizationId),
  ]);

  const suggestedInvoiceNumber = suggestNextNumber(
    "PI",
    (invoicesResult.data || []).map((i) => i.invoice_number),
  );

  const validTypes = ["challan", "salary", "expense"] as const;
  const initialType = validTypes.includes(type as PurchaseInvoiceEntryType)
    ? (type as PurchaseInvoiceEntryType)
    : "challan";

  if (challanId) {
    const { data: challan } = await supabase
      .from("challans")
      .select("id, status, purchase_invoice_id")
      .eq("id", challanId)
      .maybeSingle();

    if (!challan || challan.status === "invoiced" || challan.purchase_invoice_id) {
      redirect("/dashboard/purchase-invoices/new");
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">
          Create Purchase Invoice
        </h1>
        <p className="text-muted-foreground mt-1">
          Record a challan purchase, salary, or expense with full details
        </p>
      </div>

      <PurchaseInvoiceForm
        purchasers={purchasersResult.data || []}
        challans={challansResult.data || []}
        suggestedInvoiceNumber={suggestedInvoiceNumber}
        initialChallanId={challanId}
        initialType={initialType}
      />
    </div>
  );
}
