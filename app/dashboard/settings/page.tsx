import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DashboardPageWrapper } from "@/components/dashboard-page-wrapper"
import { SettingsForm } from "@/components/settings-form"
import { InvoiceTemplateForm } from "@/components/invoice-template-form"
import { AutomatedReportsSettings } from "@/components/automated-reports-settings"
import { MortalityTrackerConfig } from "@/components/mortality-tracker-config"

async function InvoiceTemplateSection({ organizationId }: { organizationId: string }) {
  const supabase = await createClient()
  
  const { data: template } = await supabase
    .from("invoice_templates")
    .select("*")
    .eq("organization_id", organizationId)
    .single()
  
  return <InvoiceTemplateForm existingTemplate={template} />
}

export default async function SettingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Check role (super_admin full, admin view-only)
  const { data: profile } = await supabase.from("profiles").select("role, organization_id").eq("id", user.id).single()

  if (!profile || (profile.role !== "super_admin" && profile.role !== "admin")) {
    redirect("/dashboard")
  }

  const isManagerViewOnly = profile.role === "admin"

  // Get organization settings
  const { data: organization } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", profile.organization_id)
    .single()

  // Fetch mortality tracker config and price categories (super_admin only)
  const [mortalityConfigResult, priceCategoriesResult] = profile.role === "super_admin"
    ? await Promise.all([
        supabase
          .from("mortality_tracker_config")
          .select("*")
          .eq("organization_id", profile.organization_id)
          .maybeSingle(),
        supabase
          .from("price_categories")
          .select("id, name, description, is_active")
          .eq("organization_id", profile.organization_id)
          .order("name"),
      ])
    : [{ data: null }, { data: [] }]

  return (
    <DashboardPageWrapper title="System Settings">
      <div className="w-full p-4 sm:p-6 lg:p-8 space-y-6">
        {isManagerViewOnly && (
          <div className="px-6 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-700">View-only access. Contact an admin to make changes.</p>
          </div>
        )}

        <div className="grid gap-6 px-6">
          <Card className={isManagerViewOnly ? "pointer-events-none opacity-60" : ""}>
            <CardHeader>
              <CardTitle>Organization Settings</CardTitle>
              <CardDescription>Configure your organization details and preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <SettingsForm organization={organization} />
            </CardContent>
          </Card>

          <Card className={isManagerViewOnly ? "pointer-events-none opacity-60" : ""}>
            <CardHeader>
              <CardTitle>Tax Configuration</CardTitle>
              <CardDescription>Set default tax rates and rules</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">
                Default tax rates are configured per product. You can set organization-wide defaults here in future
                updates.
              </p>
            </CardContent>
          </Card>

          <Card className={isManagerViewOnly ? "pointer-events-none opacity-60" : ""}>
            <CardHeader>
              <CardTitle>Invoice Template</CardTitle>
              <CardDescription>Customize invoice appearance and branding</CardDescription>
            </CardHeader>
            <CardContent>
              {await InvoiceTemplateSection({ organizationId: profile.organization_id })}
            </CardContent>
          </Card>

          {/* Mortality Tracker config — super_admin only */}
          {profile.role === "super_admin" && (
            <MortalityTrackerConfig
              config={mortalityConfigResult.data}
              priceCategories={priceCategoriesResult.data ?? []}
              organizationId={profile.organization_id}
            />
          )}

          <div className={isManagerViewOnly ? "pointer-events-none opacity-60" : ""}>
            <AutomatedReportsSettings organization={organization} />
          </div>
        </div>
      </div>
    </DashboardPageWrapper>
  )
}
