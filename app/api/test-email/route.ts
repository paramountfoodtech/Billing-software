import { NextRequest, NextResponse } from "next/server"

export async function GET(_req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const { sendEmail } = await import("@/lib/email/send-email")
  const { getTeamMemberWelcomeEmail } = await import(
    "@/lib/email/templates/team-member-welcome"
  )

  try {
    const { searchParams } = new URL(_req.url)
    const to = searchParams.get("to") || "hsprojects449@gmail.com"
    const from = searchParams.get("from") || process.env.EMAIL_FROM || "onboarding@resend.dev"
    const name = searchParams.get("name") || "Test User"
    const org = searchParams.get("org") || "Test Organization"

    const emailHtml = getTeamMemberWelcomeEmail({
      name,
      email: to,
      password: "test123",
      role: "admin",
      organizationName: org,
      loginUrl: "http://localhost:3000/auth/login",
    })

    const result = await sendEmail({
      to,
      subject: `Test - Welcome Email from ${org}`,
      html: emailHtml,
      from,
    })

    return NextResponse.json({
      success: result.success,
      message: result.success
        ? `Test email sent! Check inbox for ${to}`
        : `Failed: ${result.error}`,
      data: result,
      meta: { to, from },
    })
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
