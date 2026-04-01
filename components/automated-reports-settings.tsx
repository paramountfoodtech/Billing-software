"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Mail, Calendar, TrendingUp } from "lucide-react"

interface AutomatedReportsSettingsProps {
  organization: {
    id: string
    automated_reports_enabled?: boolean
    automated_report_settings?: {
      daily?: boolean
      weekly?: boolean
      monthly?: boolean
      "semi-annual"?: boolean
      annual?: boolean
    }
    report_email?: string
    email?: string
  } | null
}

export function AutomatedReportsSettings({ organization }: AutomatedReportsSettingsProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const defaultSettings = {
    daily: true,
    weekly: false,
    monthly: false,
    "semi-annual": false,
    annual: false,
  }

  const [enabled, setEnabled] = useState(organization?.automated_reports_enabled || false)
  const [reportEmail, setReportEmail] = useState(organization?.report_email || organization?.email || "")
  const [settings, setSettings] = useState({
    ...defaultSettings,
    ...(organization?.automated_report_settings || {}),
  })

  const handleSave = async () => {
    setLoading(true)

    const supabase = createClient()

    try {
      const { error } = await supabase
        .from("organizations")
        .update({
          automated_reports_enabled: enabled,
          automated_report_settings: settings,
          report_email: reportEmail,
        })
        .eq("id", organization?.id)

      if (error) throw error

      toast({
        variant: "success",
        title: "Success",
        description: "Automated reports settings updated successfully!",
      })
      router.refresh()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error updating settings: " + error.message,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleToggleSetting = (key: keyof typeof settings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Automated Email Reports
        </CardTitle>
        <CardDescription>
          Configure automated reports to be sent to your organization email on a schedule
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="enable-reports" className="text-base">Enable Automated Reports</Label>
            <p className="text-sm text-muted-foreground">
              Receive business metrics and statistics via email
            </p>
          </div>
          <Switch
            id="enable-reports"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>

        {enabled && (
          <>
            <div className="space-y-2">
              <Label htmlFor="report-email">Report Email Address</Label>
              <Input
                id="report-email"
                type="email"
                placeholder="reports@company.com"
                value={reportEmail}
                onChange={(e) => setReportEmail(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Reports will be sent to this email address
              </p>
            </div>

            <div className="space-y-4">
              <Label className="text-base">Report Frequency</Label>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg border border-blue-200 bg-blue-50/50">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    <div>
                      <p className="font-medium">Daily Report</p>
                      <p className="text-sm text-muted-foreground">Every day at 9 PM — sent to super admin (client-wise breakdown)</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.daily}
                    onCheckedChange={() => handleToggleSetting("daily")}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Weekly Report</p>
                      <p className="text-sm text-muted-foreground">Every Monday morning</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.weekly}
                    onCheckedChange={() => handleToggleSetting("weekly")}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Monthly Report</p>
                      <p className="text-sm text-muted-foreground">First day of each month</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.monthly}
                    onCheckedChange={() => handleToggleSetting("monthly")}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Semi-Annual Report</p>
                      <p className="text-sm text-muted-foreground">Every 6 months</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings["semi-annual"]}
                    onCheckedChange={() => handleToggleSetting("semi-annual")}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Financial Year Report</p>
                      <p className="text-sm text-muted-foreground">End of financial year (March 31)</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.annual}
                    onCheckedChange={() => handleToggleSetting("annual")}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        <Button onClick={handleSave} disabled={loading}>
          {loading ? "Saving..." : "Save Report Settings"}
        </Button>
      </CardContent>
    </Card>
  )
}
