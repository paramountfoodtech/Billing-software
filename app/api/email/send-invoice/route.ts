import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send-email";

function sanitizeFilename(name: string) {
  return name.replace(/[^\w.\- ()[\]]+/g, "_").slice(0, 180);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    if (!profile?.organization_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { invoiceType, invoiceId, pdfBase64, filename, companyName } =
      body as {
        invoiceType: "sales" | "purchase";
        invoiceId: string;
        pdfBase64: string;
        filename?: string;
        companyName?: string;
        // Intentionally ignored if present (do not trust client email content)
        to?: string;
        subject?: string;
        html?: string;
      };

    if (!invoiceType || !invoiceId || !pdfBase64) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    if (invoiceType !== "sales" && invoiceType !== "purchase") {
      return NextResponse.json({ error: "Invalid invoice type" }, { status: 400 });
    }

    // ~8MB decoded PDF limit (base64 is ~4/3 larger)
    if (String(pdfBase64).length > 11_000_000) {
      return NextResponse.json(
        { error: "PDF attachment is too large" },
        { status: 413 },
      );
    }

    const orgName =
      (typeof companyName === "string" && companyName.trim()) ||
      "Paramount Food Tech";

    let recipientEmail: string | null = null;
    let recipientName = "Customer";
    let invoiceNumber = invoiceId;
    let safeFilename = "invoice.pdf";

    if (invoiceType === "sales") {
      const { data: invoice } = await supabase
        .from("invoices")
        .select("id, organization_id, invoice_number, clients(name, email)")
        .eq("id", invoiceId)
        .maybeSingle();

      if (!invoice || invoice.organization_id !== profile.organization_id) {
        return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
      }

      const client = invoice.clients as
        | { name: string; email: string | null }
        | { name: string; email: string | null }[]
        | null;
      const clientRow = Array.isArray(client) ? client[0] : client;
      recipientEmail = clientRow?.email?.trim() || null;
      recipientName = clientRow?.name || "Customer";
      invoiceNumber = invoice.invoice_number;
      safeFilename = sanitizeFilename(
        filename || `invoice-${invoice.invoice_number}.pdf`,
      );
    } else {
      const { data: invoice } = await supabase
        .from("purchase_invoices")
        .select(
          "id, organization_id, invoice_number, purchaser_invoice_number, purchasers(name, email)",
        )
        .eq("id", invoiceId)
        .maybeSingle();

      if (!invoice || invoice.organization_id !== profile.organization_id) {
        return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
      }

      const purchaser = invoice.purchasers as
        | { name: string; email: string | null }
        | { name: string; email: string | null }[]
        | null;
      const purchaserRow = Array.isArray(purchaser) ? purchaser[0] : purchaser;
      recipientEmail = purchaserRow?.email?.trim() || null;
      recipientName = purchaserRow?.name || "Vendor";
      invoiceNumber =
        invoice.purchaser_invoice_number || invoice.invoice_number;
      safeFilename = sanitizeFilename(
        filename || `purchase-invoice-${invoiceNumber}.pdf`,
      );
    }

    if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      return NextResponse.json(
        { error: "No valid registered email for this invoice contact" },
        { status: 400 },
      );
    }

    const label =
      invoiceType === "purchase" ? "Purchase invoice" : "Invoice";
    const subject = `${label} ${invoiceNumber} from ${orgName}`.slice(0, 200);
    const html = `
      <p>Hello ${escapeHtml(recipientName)},</p>
      <p>Please find attached <strong>${escapeHtml(label)} ${escapeHtml(String(invoiceNumber))}</strong> from ${escapeHtml(orgName)}.</p>
      <p>Thank you.</p>
    `;

    const result = await sendEmail({
      to: recipientEmail,
      subject,
      html,
      attachments: [{ filename: safeFilename, content: pdfBase64 }],
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to send email" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      sentTo: recipientEmail,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to send invoice email",
      },
      { status: 500 },
    );
  }
}
