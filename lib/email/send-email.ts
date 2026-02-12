import { Resend } from "resend"

interface SendEmailParams {
  to: string
  subject: string
  html: string
  from?: string
}

export async function sendEmail({ to, subject, html, from }: SendEmailParams) {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { data, error } = await resend.emails.send({
      from: from || process.env.EMAIL_FROM || "onboarding@resend.dev",
      to,
      subject,
      html,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, data }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
