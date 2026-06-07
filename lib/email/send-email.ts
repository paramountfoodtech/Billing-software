import { Resend } from "resend"

interface SendEmailParams {
  to: string
  subject: string
  html: string
  from?: string
}

export async function sendEmail({ to, subject, html, from }: SendEmailParams) {
  try {
    // Prefer server-only env vars, fallback to NEXT_PUBLIC for backward compatibility
    const resendApiKey =
      process.env.RESEND_API_KEY || process.env.NEXT_PUBLIC_RESEND_API_KEY
    const emailFrom =
      process.env.EMAIL_FROM || process.env.NEXT_PUBLIC_EMAIL_FROM

    // Validate API key is set
    if (!resendApiKey) {
      console.error("[Email] RESEND_API_KEY is not configured")
      console.error("[Email] Env presence:", {
        RESEND_API_KEY: !!process.env.RESEND_API_KEY,
        NEXT_PUBLIC_RESEND_API_KEY: !!process.env.NEXT_PUBLIC_RESEND_API_KEY,
        EMAIL_FROM: !!process.env.EMAIL_FROM,
        NEXT_PUBLIC_EMAIL_FROM: !!process.env.NEXT_PUBLIC_EMAIL_FROM,
      })
      return { success: false, error: "Email service not configured: missing API key" }
    }

    // Initialize Resend client at function call time (not module load time)
    const resend = new Resend(resendApiKey)

    // Validate recipient email
    if (!to || !to.includes("@")) {
      console.error("[Email] Invalid recipient email:", to)
      return { success: false, error: "Invalid recipient email address" }
    }

    const fromEmail = from || emailFrom || "onboarding@resend.dev"
    
    console.log(`[Email] Attempting to send email from ${fromEmail} to ${to}`)

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to,
      subject,
      html,
    })

    if (error) {
      console.error(`[Email] Failed to send email: ${error.message}`)
      return { success: false, error: error.message }
    }

    console.log(`[Email] Email sent successfully to ${to}`)
    return { success: true, data }
  } catch (error: any) {
    console.error(`[Email] Exception while sending email: ${error.message}`)
    return { success: false, error: error.message }
  }
}
