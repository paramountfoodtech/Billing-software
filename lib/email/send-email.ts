import { Resend } from "resend"

interface SendEmailParams {
  to: string
  subject: string
  html: string
  from?: string
}

export async function sendEmail({ to, subject, html, from }: SendEmailParams) {
  try {
    // Validate API key is set
    if (!process.env.RESEND_API_KEY) {
      console.error("[Email] RESEND_API_KEY is not configured")
      return { success: false, error: "Email service not configured: missing API key" }
    }

    // Initialize Resend client at function call time (not module load time)
    const resend = new Resend(process.env.RESEND_API_KEY)

    // Validate recipient email
    if (!to || !to.includes("@")) {
      console.error("[Email] Invalid recipient email:", to)
      return { success: false, error: "Invalid recipient email address" }
    }

    const fromEmail = from || process.env.EMAIL_FROM || "onboarding@resend.dev"
    
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
