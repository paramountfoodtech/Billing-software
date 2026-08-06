import { redirect } from "next/navigation";

export default async function LegacyHrPortalRedirect({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const qs = params.tab ? `?tab=${encodeURIComponent(params.tab)}` : "";
  redirect(`/dashboard/expenses/payroll${qs}`);
}
