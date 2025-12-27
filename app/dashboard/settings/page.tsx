import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SettingsForm } from "@/components/settings-form"
import { InvoiceTemplateForm } from "@/components/invoice-template-form"

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

  return (
    <div className="lg:p-8 space-y-6">
      <div className="px-6 pb-2">
        <h1 className="text-2xl font-semibold text-slate-900">System Settings</h1>
        {isManagerViewOnly && (
          <p className="text-sm text-amber-700 mt-2">View-only access. Contact an admin to make changes.</p>
        )}
      </div>

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
      </div>
    </div>
  )
}
