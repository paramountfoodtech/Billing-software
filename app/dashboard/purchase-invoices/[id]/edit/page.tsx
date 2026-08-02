import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { PurchaseInvoiceForm } from "@/components/purchase-invoice-form";
import { canEditPurchaseInvoice } from "@/lib/permissions";

export default async function EditPurchaseInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single();

  if (!profile?.organization_id) {
    notFound();
  }

  const organizationId = profile.organization_id;

  const { data: invoice } = await supabase
    .from("purchase_invoices")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (
    !invoice ||
    !canEditPurchaseInvoice(profile.role, invoice.status, invoice.amount_paid)
  ) {
    notFound();
  }

  const [
    purchasersResult,
    challansResult,
    linkedChallansResult,
    categoriesResult,
    priceHistoryResult,
  ] = await Promise.all([
    supabase
      .from("purchasers")
      .select("id, name, purchaser_code, is_default")
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
        total_birds,
        challan_date,
        status,
        purchase_invoice_id,
        purchasers(name)
      `,
      )
      .eq("organization_id", organizationId)
      .eq("status", "final")
      .order("challan_date", { ascending: false }),
    supabase
      .from("challans")
      .select(
        `
        id,
        challan_number,
        purchaser_id,
        total_weight_kg,
        total_birds,
        challan_date,
        status,
        purchase_invoice_id,
        purchasers(name)
      `,
      )
      .eq("organization_id", organizationId)
      .eq("purchase_invoice_id", id)
      .order("challan_number", { ascending: true }),
    supabase
      .from("price_categories")
      .select("id, name")
      .eq("organization_id", organizationId)
      .eq("is_active", true),
    supabase
      .from("price_category_history")
      .select("price_category_id, price, effective_date")
      .eq("organization_id", organizationId),
  ]);

  const liveCategory =
    (categoriesResult.data || []).find(
      (c) => c.name?.toLowerCase() === "live",
    ) ?? null;

  const linkedChallans = linkedChallansResult.data || [];
  const linkedIds = new Set(linkedChallans.map((c) => c.id));

  // Fallback for legacy rows that only have purchase_invoices.challan_id
  if (
    invoice.challan_id &&
    !linkedIds.has(invoice.challan_id as string)
  ) {
    const { data: legacyChallan } = await supabase
      .from("challans")
      .select(
        `
        id,
        challan_number,
        purchaser_id,
        total_weight_kg,
        total_birds,
        challan_date,
        status,
        purchase_invoice_id,
        purchasers(name)
      `,
      )
      .eq("id", invoice.challan_id)
      .maybeSingle();
    if (legacyChallan) {
      linkedChallans.push(legacyChallan);
      linkedIds.add(legacyChallan.id);
    }
  }

  const challanById = new Map<string, (typeof linkedChallans)[number]>();
  for (const c of [...(challansResult.data || []), ...linkedChallans]) {
    challanById.set(c.id, c);
  }

  const challans = [...challanById.values()].filter(
    (c) =>
      linkedIds.has(c.id) ||
      (c.status === "final" && !c.purchase_invoice_id),
  );

  const initialChallanIds = linkedChallans.map((c) => c.id);

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">
          Edit Purchase Invoice
        </h1>
        <p className="text-muted-foreground mt-1">
          Update purchaser invoice details. Payments already recorded are kept.
        </p>
      </div>

      <PurchaseInvoiceForm
        purchasers={purchasersResult.data || []}
        challans={challans as any}
        suggestedInvoiceNumber={invoice.invoice_number}
        liveCategoryId={liveCategory?.id}
        priceHistory={priceHistoryResult.data || []}
        initialInvoice={invoice}
        initialChallanIds={initialChallanIds}
      />
    </div>
  );
}
