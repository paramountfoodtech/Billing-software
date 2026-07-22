import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { InvoiceForm } from "@/components/invoice-form";
import { findLastGeneralOrgInvoiceNumber } from "@/lib/invoice-number";

export default async function NewInvoicePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.organization_id) {
    redirect("/dashboard");
  }

  const organizationId = profile.organization_id;
  const isSuperAdmin = profile.role === "super_admin";

  const [
    clientsResult,
    productsResult,
    pricingRulesResult,
    pricingHistoryResult,
    categoriesResult,
    historyResult,
    recentInvoicesResult,
  ] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "id, name, email, due_days, due_days_type, enable_per_bird, value_per_bird, invoice_number_pattern_type, invoice_number_pattern",
      )
      .eq("organization_id", organizationId)
      .order("name"),
    supabase
      .from("products")
      .select(
        "id, name, description, paper_price, unit_price, unit, tax_rate, is_active",
      )
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("client_product_pricing")
      .select(
        "product_id, price_rule_type, price_rule_value, price_category_id, fixed_base_value, client_id, conditional_threshold, conditional_discount_below, conditional_discount_above_equal, price_rule_type_2, price_rule_value_2, conditional_threshold_2, conditional_discount_below_2, conditional_discount_above_equal_2, pricing_rule_steps",
      )
      .eq("organization_id", organizationId),
    supabase
      .from("client_product_pricing_history")
      .select(
        "client_id, product_id, price_rule_type, price_rule_value, price_category_id, fixed_base_value, conditional_threshold, conditional_discount_below, conditional_discount_above_equal, price_rule_type_2, price_rule_value_2, conditional_threshold_2, conditional_discount_below_2, conditional_discount_above_equal_2, pricing_rule_steps, effective_from, created_at",
      )
      .eq("organization_id", organizationId),
    supabase
      .from("price_categories")
      .select("id, name, is_active")
      .eq("organization_id", organizationId)
      .order("name"),
    supabase
      .from("price_category_history")
      .select("price_category_id, price, effective_date")
      .eq("organization_id", organizationId),
    supabase
      .from("invoices")
      .select("invoice_number, client_id, created_at, counts_toward_sequence")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const clients = clientsResult.data || [];
  const lastGeneralOrgInvoiceNumber = findLastGeneralOrgInvoiceNumber(
    recentInvoicesResult.data || [],
    clients,
  );

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Create Invoice</h1>
        <p className="text-muted-foreground mt-1">
          Generate a new invoice for a client
        </p>
      </div>

      <InvoiceForm
        clients={clients}
        products={productsResult.data || []}
        clientPricingRules={pricingRulesResult.data || []}
        clientPricingHistory={pricingHistoryResult.data || []}
        priceCategories={categoriesResult.data || []}
        priceHistory={historyResult.data || []}
        lastGeneralOrgInvoiceNumber={lastGeneralOrgInvoiceNumber}
        canToggleInvoiceSequence={isSuperAdmin}
      />
    </div>
  );
}
