"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useState } from "react"

interface InvoiceTemplate {
  id?: string
  company_name: string
  company_address: string
  company_phone: string
  company_email: string
  company_logo_url: string
  company_logo_file: string | null
  tax_label: string
  terms_and_conditions: string
}

interface InvoiceTemplateFormProps {
  existingTemplate?: InvoiceTemplate | null
}

export function InvoiceTemplateForm({ existingTemplate }: InvoiceTemplateFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(
    existingTemplate?.company_logo_file || existingTemplate?.company_logo_url || null
  )

  const [formData, setFormData] = useState<InvoiceTemplate>({
    company_name: existingTemplate?.company_name || "",
    company_address: existingTemplate?.company_address || "",
    company_phone: existingTemplate?.company_phone || "",
    company_email: existingTemplate?.company_email || "",
    company_logo_url: existingTemplate?.company_logo_url || "",
    company_logo_file: existingTemplate?.company_logo_file || null,
    tax_label: existingTemplate?.tax_label || "GST",
    terms_and_conditions: existingTemplate?.terms_and_conditions || "Payment is due within 30 days. Late payments may incur additional charges.",
  })

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        setError("Please upload an image file")
        return
      }

      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        setError("Image size should be less than 2MB")
        return
      }

      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = reader.result as string
        setFormData({ ...formData, company_logo_file: base64String, company_logo_url: "" })
        setLogoPreview(base64String)
        setError(null)
      }
      reader.readAsDataURL(file)
    }
  }

  const clearLogo = () => {
    setFormData({ ...formData, company_logo_file: null, company_logo_url: "" })
    setLogoPreview(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setError("You must be logged in")
      setIsLoading(false)
      return
    }

    try {
      // Get user's organization
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

      if (!profile?.organization_id) {
        throw new Error("User must belong to an organization")
      }

      if (existingTemplate?.id) {
        // Update existing template
        const { error } = await supabase
          .from("invoice_templates")
          .update(formData)
          .eq("id", existingTemplate.id)

        if (error) throw error
      } else {
        // Create new template (upsert to handle unique constraint)
        const { error } = await supabase
          .from("invoice_templates")
          .upsert({
            ...formData,
            organization_id: profile.organization_id,
          })

        if (error) throw error
      }

      router.push("/dashboard/settings")
      router.refresh()
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice Template Settings</CardTitle>
        <p className="text-sm text-muted-foreground">
          Customize how your invoices appear when printed
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="company_name">
                Company Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="company_name"
                required
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                placeholder="Your Company Name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_email">
                Company Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="company_email"
                type="email"
                required
                value={formData.company_email}
                onChange={(e) => setFormData({ ...formData, company_email: e.target.value })}
                placeholder="info@company.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_phone">
                Company Phone <span className="text-red-500">*</span>
              </Label>
              <Input
                id="company_phone"
                required
                value={formData.company_phone}
                onChange={(e) => setFormData({ ...formData, company_phone: e.target.value })}
                placeholder="+91 00000 00000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tax_label">Tax Label</Label>
              <Input
                id="tax_label"
                value={formData.tax_label}
                onChange={(e) => setFormData({ ...formData, tax_label: e.target.value })}
                placeholder="GST"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company_address">
              Company Address <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="company_address"
              required
              value={formData.company_address}
              onChange={(e) => setFormData({ ...formData, company_address: e.target.value })}
              placeholder="123 Business Street, City, State 12345"
              rows={2}
            />
          </div>

          <div className="space-y-3">
            <Label>Company Logo</Label>
            <div className="grid gap-4">
              {/* Option 1: Upload File */}
              <div className="space-y-2">
                <Label htmlFor="company_logo_file" className="text-sm font-normal">
                  Upload Logo File
                </Label>
                <Input
                  id="company_logo_file"
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={!!formData.company_logo_url}
                />
                <p className="text-xs text-muted-foreground">
                  Upload your logo (PNG, JPG, max 2MB)
                </p>
              </div>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              {/* Option 2: URL */}
              <div className="space-y-2">
                <Label htmlFor="company_logo_url" className="text-sm font-normal">
                  Logo URL
                </Label>
                <Input
                  id="company_logo_url"
                  type="url"
                  value={formData.company_logo_url}
                  onChange={(e) => {
                    setFormData({ ...formData, company_logo_url: e.target.value, company_logo_file: null })
                    setLogoPreview(e.target.value)
                  }}
                  placeholder="https://example.com/logo.png"
                  disabled={!!formData.company_logo_file}
                />
                <p className="text-xs text-muted-foreground">
                  Or provide a URL to your company logo
                </p>
              </div>

              {/* Preview */}
              {logoPreview && (
                <div className="space-y-2">
                  <Label className="text-sm font-normal">Preview</Label>
                  <div className="relative inline-block">
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="h-20 w-auto object-contain border rounded-md p-2"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                      onClick={clearLogo}
                    >
                      ×
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="terms_and_conditions">Terms & Conditions</Label>
            <Textarea
              id="terms_and_conditions"
              value={formData.terms_and_conditions}
              onChange={(e) => setFormData({ ...formData, terms_and_conditions: e.target.value })}
              placeholder="Payment terms and conditions..."
              rows={4}
            />
          </div>

          {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</div>}

          <div className="flex gap-4">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : existingTemplate ? "Update Template" : "Save Template"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
