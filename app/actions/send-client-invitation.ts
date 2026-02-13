"use server"

import { createClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/email/send-email"
import { getClientInvitationEmail } from "@/lib/email/templates/client-invitation"

export async function sendClientInvitation(clientEmail: string, clientName: string) {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "Not authenticated" }
    }

    // Get user's organization details
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single()

    if (!profile?.organization_id) {
      return { success: false, error: "User must belong to an organization" }
    }

    const { data: organization } = await supabase
      .from("organizations")
      .select("name, email, phone")
      .eq("id", profile.organization_id)
      .single()

    if (!organization) {
      return { success: false, error: "Organization not found" }
    }

    // Generate invitation email
    const emailHtml = getClientInvitationEmail({
      clientName,
      organizationName: organization.name,
      message: `We're excited to have you as our valued client. Your account has been set up in our billing system, and you'll receive all invoices and updates at this email address.`,
      contactEmail: organization.email || undefined,
      contactPhone: organization.phone || undefined,
    })

    // Send email
    const result = await sendEmail({
      to: clientEmail,
      subject: `Welcome - ${organization.name}`,
      html: emailHtml,
    })

    if (!result.success) {
      console.error(`[SendClientInvitation] Failed to send invitation to ${clientEmail}: ${result.error}`)
    }

    return result
  } catch (error: any) {
    console.error(`[SendClientInvitation] Exception: ${error.message}`)
    return { success: false, error: error.message }
  }
}
