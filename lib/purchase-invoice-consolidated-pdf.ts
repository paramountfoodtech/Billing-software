import { formatIndianDate } from "@/lib/date-time";
import { createClient } from "@/lib/supabase/client";
import { getTimestamp } from "@/lib/export-utils";

type InvoiceTemplate = {
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_logo_url: string | null;
  company_logo_file: string | null;
};

type PurchaseInvoiceForExport = {
  id: string;
  invoice_number: string;
  purchaser_invoice_number?: string | null;
  issue_date: string;
  total_weight_kg: string | number;
  price_per_kg: string | number;
  total_amount: string | number;
  discount_amount?: string | number | null;
  amount_paid: string | number;
  notes?: string | null;
  description?: string | null;
  purchasers?: {
    name: string;
    purchaser_code?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip_code?: string | null;
  } | null;
  challans?: {
    challan_number: string;
    challan_date: string;
    num_boxes?: number | null;
    total_birds?: number | null;
    challan_boxes?: {
      box_number: number;
      weight_kg: string | number;
      num_birds?: number | null;
    }[];
  } | null;
};

const DEFAULT_TEMPLATE: InvoiceTemplate = {
  company_name: "Your Company Name",
  company_address: "123 Business Street, City, State 12345",
  company_phone: "+91 00000 00000",
  company_email: "info@company.com",
  company_logo_url: "/PFT logo.png",
  company_logo_file: null,
};

function formatCurrency(amount: string | number): string {
  return `Rs. ${Number(amount || 0).toFixed(2)}`;
}

async function loadLogo(activeTemplate: InvoiceTemplate) {
  let logoImg: {
    data: string;
    format: string;
    width: number;
    height: number;
  } | null = null;

  try {
    const logoSource =
      activeTemplate.company_logo_file || activeTemplate.company_logo_url;
    if (!logoSource) return null;

    const resolvedLogoSource = logoSource.startsWith("data:")
      ? logoSource
      : logoSource.startsWith("http://") || logoSource.startsWith("https://")
        ? encodeURI(logoSource)
        : logoSource.startsWith("/")
          ? `${window.location.origin}${encodeURI(logoSource)}`
          : `${window.location.origin}/${encodeURI(logoSource)}`;

    const loadedImage = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = resolvedLogoSource;
    });

    const width = loadedImage.naturalWidth || loadedImage.width;
    const height = loadedImage.naturalHeight || loadedImage.height;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create canvas context for logo.");
    ctx.drawImage(loadedImage, 0, 0, width, height);

    logoImg = {
      data: canvas.toDataURL("image/png"),
      format: "PNG",
      width,
      height,
    };
  } catch (error) {
    console.warn("Could not load logo image:", error);
  }

  return logoImg;
}

export async function fetchPurchaseInvoicesForExport(invoiceIds: string[]) {
  if (invoiceIds.length === 0) return [] as PurchaseInvoiceForExport[];

  const supabase = createClient();
  const { data, error } = await supabase
    .from("purchase_invoices")
    .select(
      `
      id,
      invoice_number,
      purchaser_invoice_number,
      issue_date,
      total_weight_kg,
      price_per_kg,
      total_amount,
      discount_amount,
      amount_paid,
      notes,
      description,
      purchasers(
        name,
        purchaser_code,
        email,
        phone,
        address,
        city,
        state,
        zip_code
      ),
      challans!purchase_invoices_challan_id_fkey(
        challan_number,
        challan_date,
        num_boxes,
        total_birds,
        challan_boxes(box_number, weight_kg, num_birds)
      )
    `,
    )
    .in("id", invoiceIds)
    .order("issue_date", { ascending: true });

  if (error) throw error;
  return (data || []) as unknown as PurchaseInvoiceForExport[];
}

export async function exportConsolidatedPurchaseInvoicesPDF(options: {
  invoiceIds: string[];
  fromDate?: string;
  toDate?: string;
  filenamePrefix?: string;
}): Promise<number> {
  const {
    invoiceIds,
    fromDate = "",
    toDate = "",
    filenamePrefix = "consolidated_purchase_invoices",
  } = options;

  if (invoiceIds.length === 0) return 0;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let template: InvoiceTemplate | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (profile?.organization_id) {
      const { data: templateData } = await supabase
        .from("invoice_templates")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .maybeSingle();
      template = templateData;
    }
  }

  const activeTemplate = template || DEFAULT_TEMPLATE;
  const invoices = await fetchPurchaseInvoicesForExport(invoiceIds);
  if (invoices.length === 0) return 0;

  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });
  const logoImg = await loadLogo(activeTemplate);

  for (let i = 0; i < invoices.length; i++) {
    const invoice = invoices[i];
    if (i > 0) pdf.addPage();

    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 15;
    let y = margin;
    const spacing = {
      sectionGap: 4,
      logoToCompany: 5,
      companyTitleToMeta: 3,
      lineGap: 3.2,
      logoTopPadding: 0,
    };

    const discountAmount = Number(invoice.discount_amount || 0);
    const weight = Number(invoice.total_weight_kg || 0);
    const rate = Number(invoice.price_per_kg || 0);
    const subtotal = weight * rate || Number(invoice.total_amount) + discountAmount;
    const balance = Number(invoice.total_amount) - Number(invoice.amount_paid);
    const hasChallan = Boolean(invoice.challans?.challan_number);
    const boxes = invoice.challans?.challan_boxes || [];
    const totalBirds =
      Number(invoice.challans?.total_birds || 0) ||
      boxes.reduce((sum, box) => sum + Number(box.num_birds || 0), 0);
    const lineDescription =
      invoice.description?.trim() ||
      (hasChallan
        ? `Purchase weight (Purchase challan ${invoice.challans!.challan_number})`
        : "Purchase invoice");

    const headerTopY = y;
    const logoX = margin;
    const logoY = headerTopY + spacing.logoTopPadding;
    const logoMaxHeight = 14;
    const logoMaxWidth = 40;
    let logoWidth = 0;
    let logoHeight = logoMaxHeight;

    if (logoImg) {
      try {
        const logoRatio = logoImg.width / logoImg.height;
        logoWidth = Math.min(logoMaxWidth, logoMaxHeight * logoRatio);
        logoHeight = logoWidth / logoRatio;
        pdf.addImage(
          logoImg.data,
          logoImg.format,
          logoX,
          logoY,
          logoWidth,
          logoHeight,
        );
      } catch (error) {
        console.warn("Could not add logo to PDF:", error);
      }
    }

    const companyX = margin;
    const companyTextWidth = pageWidth * 0.5 - margin;
    let companyY = logoY + logoHeight + spacing.logoToCompany;
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text(activeTemplate.company_name, companyX, companyY);
    companyY += spacing.companyTitleToMeta;
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    const companyAddressLines = pdf.splitTextToSize(
      activeTemplate.company_address || "",
      companyTextWidth,
    );
    if (companyAddressLines.length > 0) {
      pdf.text(companyAddressLines, companyX, companyY);
      companyY += companyAddressLines.length * spacing.lineGap;
    }
    pdf.text(`Phone: ${activeTemplate.company_phone}`, companyX, companyY);
    companyY += spacing.lineGap;
    pdf.text(`Email: ${activeTemplate.company_email}`, companyX, companyY);
    const leftBlockBottomY = companyY + 1;

    const rightX = pageWidth - margin;
    let rightY = logoY + 2;
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("PURCHASE INVOICE", rightX, rightY, { align: "right" });
    rightY += spacing.sectionGap;
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Invoice #: ${invoice.invoice_number}`, rightX, rightY, {
      align: "right",
    });
    rightY += spacing.lineGap;
    if (invoice.purchaser_invoice_number) {
      pdf.text(
        `Purchaser Invoice #: ${invoice.purchaser_invoice_number}`,
        rightX,
        rightY,
        { align: "right" },
      );
      rightY += spacing.lineGap;
    }
    pdf.text(
      `Date: ${formatIndianDate(invoice.issue_date, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })}`,
      rightX,
      rightY,
      { align: "right" },
    );
    rightY += spacing.lineGap;
    if (hasChallan) {
      pdf.text(
        `Purchase challan: ${invoice.challans!.challan_number}`,
        rightX,
        rightY,
        { align: "right" },
      );
      rightY += spacing.lineGap;
      pdf.text(
        `Challan date: ${formatIndianDate(invoice.challans!.challan_date, {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}`,
        rightX,
        rightY,
        { align: "right" },
      );
      rightY += spacing.lineGap;
    }
    const rightBlockBottomY = rightY + 1;
    y = Math.max(leftBlockBottomY, rightBlockBottomY) + spacing.sectionGap;

    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.text("Purchased From:", margin, y);
    y += spacing.lineGap;
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    const billToWidth = pageWidth * 0.55 - margin;
    if (invoice.purchasers) {
      const nameLines = pdf.splitTextToSize(
        invoice.purchasers.name || "N/A",
        billToWidth,
      );
      pdf.text(nameLines, margin, y);
      y += nameLines.length * spacing.lineGap;
      if (invoice.purchasers.purchaser_code) {
        pdf.text(`ID: ${invoice.purchasers.purchaser_code}`, margin, y);
        y += spacing.lineGap;
      }
      if (invoice.purchasers.address) {
        pdf.text(invoice.purchasers.address, margin, y);
        y += spacing.lineGap;
      }
      if (invoice.purchasers.city && invoice.purchasers.state) {
        pdf.text(
          `${invoice.purchasers.city}, ${invoice.purchasers.state} ${invoice.purchasers.zip_code || ""}`.trim(),
          margin,
          y,
        );
        y += spacing.lineGap;
      }
      if (invoice.purchasers.email) {
        pdf.text(`Email: ${invoice.purchasers.email}`, margin, y);
        y += spacing.lineGap;
      }
      if (invoice.purchasers.phone) {
        pdf.text(`Phone: ${invoice.purchasers.phone}`, margin, y);
        y += spacing.lineGap;
      }
    } else {
      pdf.text("N/A", margin, y);
      y += spacing.lineGap;
    }

    y += spacing.sectionGap;

    const tableWidth = pageWidth - 2 * margin;
    const cols = {
      description: tableWidth * 0.46,
      qty: tableWidth * 0.18,
      rate: tableWidth * 0.18,
      amount: tableWidth * 0.18,
    };
    pdf.setFillColor(240, 240, 240);
    pdf.rect(margin, y - 4, tableWidth, 7, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.text("Description", margin + 1, y);
    pdf.text("Qty (KG)", margin + cols.description + cols.qty - 1, y, {
      align: "right",
    });
    pdf.text(
      "Rate",
      margin + cols.description + cols.qty + cols.rate - 1,
      y,
      { align: "right" },
    );
    pdf.text("Amount", margin + tableWidth - 1, y, { align: "right" });
    y += 6;

    pdf.setFont("helvetica", "normal");
    const descLines = pdf.splitTextToSize(lineDescription, cols.description - 2);
    pdf.text(descLines, margin + 1, y);
    pdf.text(
      weight > 0 ? weight.toFixed(3) : "—",
      margin + cols.description + cols.qty - 1,
      y,
      { align: "right" },
    );
    pdf.text(
      weight > 0 ? formatCurrency(rate) : "—",
      margin + cols.description + cols.qty + cols.rate - 1,
      y,
      { align: "right" },
    );
    pdf.text(formatCurrency(subtotal), margin + tableWidth - 1, y, {
      align: "right",
    });
    y += Math.max(descLines.length * spacing.lineGap, spacing.lineGap) + 2;

    if (weight > 0) {
      pdf.setFont("helvetica", "bold");
      pdf.text("Total weight (kgs):", margin + 1, y);
      pdf.text(weight.toFixed(3), margin + cols.description + cols.qty - 1, y, {
        align: "right",
      });
      y += spacing.lineGap;
    }
    if (hasChallan && Number(invoice.challans?.num_boxes || 0) > 0) {
      pdf.text("Boxes:", margin + 1, y);
      pdf.text(
        String(invoice.challans!.num_boxes),
        margin + cols.description + cols.qty - 1,
        y,
        { align: "right" },
      );
      y += spacing.lineGap;
    }
    if (totalBirds > 0) {
      pdf.text("Total birds:", margin + 1, y);
      pdf.text(String(totalBirds), margin + cols.description + cols.qty - 1, y, {
        align: "right",
      });
      y += spacing.lineGap;
    }

    if (boxes.length > 0) {
      y += spacing.sectionGap;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.text("Box-wise Details", margin, y);
      y += spacing.lineGap + 1;
      pdf.setFontSize(7);
      pdf.setFillColor(240, 240, 240);
      pdf.rect(margin, y - 4, tableWidth, 7, "F");
      pdf.text("Box #", margin + 1, y);
      pdf.text("Weight (KG)", margin + tableWidth * 0.55, y, { align: "right" });
      pdf.text("Birds", margin + tableWidth - 1, y, { align: "right" });
      y += 6;
      pdf.setFont("helvetica", "normal");
      for (const box of boxes) {
        if (y > pdf.internal.pageSize.getHeight() - 30) {
          pdf.addPage();
          y = margin;
        }
        pdf.text(String(box.box_number), margin + 1, y);
        pdf.text(
          Number(box.weight_kg).toFixed(3),
          margin + tableWidth * 0.55,
          y,
          { align: "right" },
        );
        pdf.text(String(Number(box.num_birds || 0)), margin + tableWidth - 1, y, {
          align: "right",
        });
        y += spacing.lineGap;
      }
    }

    y += spacing.sectionGap + 2;
    const totalsX = pageWidth - margin;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text(`Subtotal: ${formatCurrency(subtotal)}`, totalsX, y, {
      align: "right",
    });
    y += spacing.lineGap;
    if (discountAmount > 0) {
      pdf.text(`Discount: -${formatCurrency(discountAmount)}`, totalsX, y, {
        align: "right",
      });
      y += spacing.lineGap;
    }
    pdf.setFont("helvetica", "bold");
    pdf.text(
      `Total: ${formatCurrency(invoice.total_amount)}`,
      totalsX,
      y,
      { align: "right" },
    );
    y += spacing.lineGap;
    pdf.setFont("helvetica", "normal");
    pdf.text(`Paid: ${formatCurrency(invoice.amount_paid)}`, totalsX, y, {
      align: "right",
    });
    y += spacing.lineGap;
    pdf.setFont("helvetica", "bold");
    pdf.text(`Balance: ${formatCurrency(balance)}`, totalsX, y, {
      align: "right",
    });

    if (invoice.notes?.trim()) {
      y += spacing.sectionGap + 2;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.text("Notes:", margin, y);
      y += spacing.lineGap;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      const noteLines = pdf.splitTextToSize(
        invoice.notes.trim(),
        pageWidth - 2 * margin,
      );
      pdf.text(noteLines, margin, y);
    }
  }

  const rangeLabel =
    fromDate || toDate ? `_${fromDate || "start"}_to_${toDate || "end"}` : "";
  pdf.save(`${filenamePrefix}${rangeLabel}_${getTimestamp()}.pdf`);
  return invoices.length;
}
