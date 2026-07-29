import { createClient } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/supabase/fetch-all";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { InvoicesPageClient } from "./invoices-page-client";
import { DashboardPageWrapper } from "@/components/dashboard-page-wrapper";
import { MissedInvoiceNumbers } from "@/components/missed-invoice-numbers";
import { findMissedInvoiceNumbers, groupMissedInvoices } from "@/lib/invoice-gaps";
import { excludeDiscardedMissedNumbers } from "@/lib/discarded-invoice-numbers";

export default async function InvoicesPage() {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get all clients for selector (parallel with profile lookup)
  const profilePromise = user
    ? supabase
        .from("profiles")
        .select("role, organization_id")
        .eq("id", user.id)
        .maybeSingle()
    : Promise.resolve({ data: null });

  const [{ data: profile }, { data: clients }] = await Promise.all([
    profilePromise,
    supabase.from("clients").select("id, name").order("name", { ascending: true }),
  ]);

  const userRole = profile?.role;
  const organizationId = profile?.organization_id ?? undefined;

  const invoices = await fetchAllPages(async (from, to) => {
    const { data, error } = await supabase
      .from("invoices")
      .select(
        `
        *,
        clients(name, email),
        profiles!invoices_created_by_fkey(full_name)
      `,
      )
      .order("created_at", { ascending: false })
      .range(from, to);
    return { data, error };
  });

  let discardedNumbers: Array<{
    id: string;
    invoice_number: string;
    note: string;
    discarded_at: string;
    discarded_by_name: string | null;
  }> = [];

  if (userRole === "super_admin" && organizationId) {
    const { data: discarded } = await supabase
      .from("discarded_invoice_numbers")
      .select("id, invoice_number, note, discarded_at, discarded_by_name")
      .eq("organization_id", organizationId)
      .is("restored_at", null)
      .order("discarded_at", { ascending: false });

    discardedNumbers = discarded || [];
  }

  // Calculate missed invoice numbers for super admin (excluding discarded)
  const rawMissedNumbers =
    userRole === "super_admin" ? findMissedInvoiceNumbers(invoices || []) : [];
  const missedNumbers = excludeDiscardedMissedNumbers(
    rawMissedNumbers,
    discardedNumbers,
  );
  const missedRanges = groupMissedInvoices(missedNumbers);

  return (
    <DashboardPageWrapper title="Invoices">
      <div className="w-full p-4 sm:p-6 lg:p-8 space-y-4">
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3">
          {userRole === "super_admin" &&
            (missedNumbers.length > 0 || discardedNumbers.length > 0) && (
            <MissedInvoiceNumbers
              missedNumbers={missedNumbers}
              ranges={missedRanges}
              discardedNumbers={discardedNumbers}
            />
          )}
          <Button asChild className="w-full sm:w-auto">
            <Link href="/dashboard/invoices/new">
              <Plus className="h-4 w-4 mr-2" />
              Create Invoice
            </Link>
          </Button>
        </div>

        <InvoicesPageClient
          clients={clients || []}
          invoices={invoices || []}
          userRole={userRole}
        />
      </div>
    </DashboardPageWrapper>
  );
}
