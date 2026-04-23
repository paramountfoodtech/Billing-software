"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import {
  Eye,
  Pencil,
  Trash2,
  Download,
  FileText,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState, useMemo, ReactNode } from "react";
import { usePagination } from "@/hooks/use-pagination";
import { TablePagination } from "@/components/table-pagination";
import { exportToCSV, exportToPDF, ExportColumn, getTimestamp } from "@/lib/export-utils";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Invoice {
  id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  due_days_type?: string | null;
  status: string;
  total_amount: string;
  amount_paid: string;
  clients: {
    name: string;
    email: string;
  };
}

interface InvoicesTableProps {
  invoices: Invoice[];
  toolbarLeft?: ReactNode;
  userRole?: string;
  fromDate?: string;
  toDate?: string;
}

const statusConfig = {
  draft: { label: "Draft", className: "bg-gray-100 text-gray-800" },
  recorded: { label: "Recorded", className: "bg-blue-100 text-blue-800" },
  partially_paid: {
    label: "Partially Paid",
    className: "bg-yellow-100 text-yellow-800",
  },
  paid: { label: "Paid", className: "bg-green-100 text-green-800" },
  overdue: { label: "Overdue", className: "bg-red-100 text-red-800" },
  cancelled: { label: "Cancelled", className: "bg-slate-100 text-slate-800" },
};

export function InvoicesTable({
  invoices,
  toolbarLeft,
  userRole,
  fromDate = "",
  toDate = "",
}: InvoicesTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Pagination state
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Filter state
  const [filters, setFilters] = useState({
    invoice_number: "",
    client: "",
    status: "",
  });

  // Date range filter (by issue_date)
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const handleFilterChange = (column: string, value: string) => {
    setFilters((prev) => ({ ...prev, [column]: value }));
  };

  // Apply filtering and sorting
  const processedInvoices = useMemo(() => {
    let filtered = [...invoices];

    // Apply filters
    if (filters.invoice_number) {
      filtered = filtered.filter((inv) =>
        inv.invoice_number
          .toLowerCase()
          .includes(filters.invoice_number.toLowerCase()),
      );
    }
    if (filters.client) {
      filtered = filtered.filter((inv) =>
        inv.clients.name.toLowerCase().includes(filters.client.toLowerCase()),
      );
    }
    if (filters.status) {
      filtered = filtered.filter((inv) =>
        inv.status.toLowerCase().includes(filters.status.toLowerCase()),
      );
    }

    // Apply sorting
    if (sortColumn) {
      filtered.sort((a, b) => {
        let aVal: any;
        let bVal: any;

        switch (sortColumn) {
          case "invoice_number":
            aVal = a.invoice_number;
            bVal = b.invoice_number;
            break;
          case "client":
            aVal = a.clients.name;
            bVal = b.clients.name;
            break;
          case "issue_date":
            aVal = new Date(a.issue_date).getTime();
            bVal = new Date(b.issue_date).getTime();
            break;
          case "due_date":
            aVal = new Date(a.due_date).getTime();
            bVal = new Date(b.due_date).getTime();
            break;
          case "total_amount":
            aVal = Number(a.total_amount);
            bVal = Number(b.total_amount);
            break;
          case "amount_paid":
            aVal = Number(a.amount_paid);
            bVal = Number(b.amount_paid);
            break;
          case "due_amount":
            aVal = Number(a.total_amount) - Number(a.amount_paid);
            bVal = Number(b.total_amount) - Number(b.amount_paid);
            break;
          case "status":
            aVal = a.status;
            bVal = b.status;
            break;
          default:
            return 0;
        }

        if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [invoices, filters, sortColumn, sortDirection]);

  const pagination = usePagination({
    items: processedInvoices,
    itemsPerPage,
  });

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column)
      return <ArrowUpDown className="ml-2 h-4 w-4 inline opacity-40" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-2 h-4 w-4 inline" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4 inline" />
    );
  };

  const handleDelete = async () => {
    if (!invoiceToDelete) return;

    setIsDeleting(true);
    const supabase = createClient();

    const { error } = await supabase
      .from("invoices")
      .delete()
      .eq("id", invoiceToDelete);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete invoice.",
      });
    } else {
      toast({
        variant: "success",
        title: "Invoice deleted",
        description: "The invoice has been deleted successfully.",
      });
      router.refresh();
    }

    setIsDeleting(false);
    setDeleteDialogOpen(false);
    setInvoiceToDelete(null);
  };

  const handleExport = () => {
    // Enrich invoices with due amount calculation and format due_date based on due_days_type
    const enrichedInvoices = processedInvoices.map((invoice) => ({
      ...invoice,
      due_amount: (
        Number(invoice.total_amount) - Number(invoice.amount_paid)
      ).toFixed(2),
      due_date_display:
        invoice.due_days_type === "end_of_month"
          ? "End of the billed month"
          : new Date(invoice.due_date).toLocaleDateString("en-IN", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }),
    }));

    const columns: ExportColumn[] = [
      { key: "invoice_number", label: "Invoice Number" },
      {
        key: "clients",
        label: "Client Name",
        formatter: (client) => client?.name || "",
      },
      {
        key: "issue_date",
        label: "Issue Date",
        formatter: (date) =>
          new Date(date).toLocaleDateString("en-IN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }),
      },
      {
        key: "due_date_display",
        label: "Due Date",
      },
      {
        key: "total_amount",
        label: "Total Amount",
        formatter: (amount) => Number(amount).toFixed(2),
      },
      {
        key: "amount_paid",
        label: "Amount Paid",
        formatter: (amount) => Number(amount).toFixed(2),
      },
      {
        key: "due_amount",
        label: "Due Amount",
      },
      {
        key: "status",
        label: "Status",
        formatter: (status) =>
          statusConfig[status as keyof typeof statusConfig]?.label || status,
      },
    ];

    exportToCSV(enrichedInvoices, columns, `invoices-${getTimestamp()}.csv`);
    toast({
      variant: "success",
      title: "Exported",
      description: `${enrichedInvoices.length} invoice(s) exported to CSV successfully.`,
    });
  };

  const handleExportPDF = async () => {
    const enrichedInvoices = processedInvoices.map((invoice) => ({
      ...invoice,
      client_name: invoice.clients.name,
      issue_date_fmt: new Date(invoice.issue_date).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }),
      due_date_display:
        invoice.due_days_type === "end_of_month"
          ? "End of billed month"
          : new Date(invoice.due_date).toLocaleDateString("en-IN", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }),
      total_fmt: `Rs.${Number(invoice.total_amount).toFixed(2)}`,
      paid_fmt: `Rs.${Number(invoice.amount_paid).toFixed(2)}`,
      due_fmt: `Rs.${(Number(invoice.total_amount) - Number(invoice.amount_paid)).toFixed(2)}`,
      status_label:
        statusConfig[invoice.status as keyof typeof statusConfig]?.label ||
        invoice.status,
    }));

    const pdfColumns: ExportColumn[] = [
      { key: "invoice_number", label: "Invoice #" },
      { key: "client_name", label: "Client" },
      { key: "issue_date_fmt", label: "Issue Date" },
      { key: "due_date_display", label: "Due Date" },
      { key: "total_fmt", label: "Total" },
      { key: "paid_fmt", label: "Paid" },
      { key: "due_fmt", label: "Due" },
      { key: "status_label", label: "Status" },
    ];

    const rangeLabel =
      fromDate || toDate
        ? ` (${fromDate || "..."} to ${toDate || "..."})`
        : "";
    await exportToPDF(
      enrichedInvoices,
      pdfColumns,
      `Invoices${rangeLabel}`,
      `invoices-${getTimestamp()}.pdf`,
    );
    toast({
      variant: "success",
      title: "Exported",
      description: `${enrichedInvoices.length} invoice(s) exported to PDF successfully.`,
    });
  };

  // Helper function to format currency with proper character encoding for jsPDF
  const formatCurrency = (amount: string | number): string => {
    const num = Number(amount || 0).toFixed(2);
    // Use Unicode escape sequence for rupee symbol
    return '\u20B9' + num;
  };

  const handleExportConsolidatedPDF = async () => {
    if (processedInvoices.length === 0) return;

    toast({
      title: "Generating PDF",
      description: "Please wait while we generate the consolidated PDF...",
    });

    const supabase = createClient();

    // Get user's organization
    const { data: { user } } = await supabase.auth.getUser();
    let template = null;

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
          .single();

        template = templateData;
      }
    }

    // Default template if not found
    const activeTemplate = template || {
      company_name: "Your Company Name",
      company_address: "123 Business Street, City, State 12345",
      company_phone: "+91 00000 00000",
      company_email: "info@company.com",
      company_logo_url: "/PFT logo.png",
      company_logo_file: null,
      terms_and_conditions: "Payment is due within 30 days. Late payments may incur additional charges.",
    };

    // Fetch full invoice data for each processed invoice
    const fullInvoices = await Promise.all(
      processedInvoices.map(async (inv) => {
        const { data: invoice, error } = await supabase
          .from("invoices")
          .select(`
            *,
            clients(name, email, phone, address, city, state, zip_code, enable_per_bird, value_per_bird),
            invoice_items(*)
          `)
          .eq("id", inv.id)
          .single();

        if (error) {
          console.error("Error fetching invoice:", inv.id, error);
          return null;
        }

        return invoice;
      })
    );

    const validInvoices = fullInvoices.filter(inv => inv !== null);

    if (validInvoices.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No valid invoice data found to export.",
      });
      return;
    }

    const { jsPDF } = await import("jspdf");

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    // Load logo image
    let logoImg: { data: string; format: string } | null = null;
    try {
      // Use template logo file if available, otherwise use logo URL
      const logoSource = activeTemplate.company_logo_file || activeTemplate.company_logo_url;
      if (logoSource) {
        let base64Data: string;
        let format = "PNG";

        if (logoSource.startsWith('data:')) {
          // Already base64 encoded - extract format and data
          const matches = logoSource.match(/^data:image\/(\w+);base64,(.+)$/);
          if (matches) {
            format = matches[1].toUpperCase();
            base64Data = matches[2];
          } else {
            base64Data = logoSource;
          }
        } else {
          // Fetch from URL
          const response = await fetch(encodeURI(logoSource));
          const blob = await response.blob();
          
          // Determine format from blob type
          if (blob.type.includes('jpeg') || blob.type.includes('jpg')) {
            format = "JPEG";
          } else if (blob.type.includes('png')) {
            format = "PNG";
          }

          base64Data = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
              const base64 = result.split(',')[1];
              resolve(base64);
            };
            reader.readAsDataURL(blob);
          });
        }

        logoImg = { data: base64Data, format };
      }
    } catch (error) {
      console.warn("Could not load logo image:", error);
    }

    for (let i = 0; i < validInvoices.length; i++) {
      const invoice = validInvoices[i];

      if (!invoice || !invoice.invoice_items || invoice.invoice_items.length === 0) continue;

      if (i > 0) {
        pdf.addPage();
      }

      // Set up page
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let y = margin;

      // Calculate totals for the invoice
      const totalWeight = invoice.invoice_items.reduce(
        (sum, item) => sum + Number(item.quantity || 0),
        0,
      );
      const totalSkinlessWeight = invoice.invoice_items.reduce(
        (sum, item) => sum + Number(item.skinless_weight || 0),
        0,
      );
      const balance = Number(invoice.total_amount) - Number(invoice.amount_paid);

      // ===== HEADER: Logo + Company (Left) | INVOICE + Details (Right) =====
      const logoX = margin;
      const logoY = y;
      const logoSize = 14; // h-14 equivalent

      // Logo on left
      if (logoImg) {
        try {
          pdf.addImage(logoImg.data, logoImg.format, logoX, logoY, logoSize, logoSize);
        } catch (error) {
          console.warn("Could not add logo to PDF:", error);
        }
      }

      // Company details below logo on left
      const companyX = margin;
      let companyY = logoY + logoSize + 2;

      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.text(activeTemplate.company_name, companyX, companyY);
      companyY += 4;

      pdf.setFontSize(7);
      pdf.setFont("helvetica", "normal");
      pdf.text(activeTemplate.company_address, companyX, companyY);
      companyY += 3;
      pdf.text(`Phone: ${activeTemplate.company_phone}`, companyX, companyY);
      companyY += 3;
      pdf.text(`Email: ${activeTemplate.company_email}`, companyX, companyY);

      // INVOICE title and details on right
      const rightX = pageWidth - margin - 60;
      let rightY = logoY;

      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text("INVOICE", rightX, rightY);
      rightY += 5;

      pdf.setFontSize(7);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Invoice #: ${invoice.invoice_number}`, rightX, rightY);
      rightY += 3;

      if (invoice.reference_number) {
        pdf.text(`Ref: ${invoice.reference_number}`, rightX, rightY);
        rightY += 3;
      }

      pdf.text(`Date: ${new Date(invoice.issue_date).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })}`, rightX, rightY);
      rightY += 3;

      pdf.text(`Due Date: ${invoice.due_days_type === "end_of_month" ? "End of the billed month" : new Date(invoice.due_date).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })}`, rightX, rightY);

      y = logoY + logoSize + 20;

      // ===== BILL TO SECTION =====
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.text("Bill To:", margin, y);
      y += 3;

      pdf.setFontSize(7);
      pdf.setFont("helvetica", "normal");
      pdf.text(invoice.clients?.name || 'N/A', margin, y);
      y += 3;
      if (invoice.clients?.address) {
        pdf.text(invoice.clients.address, margin, y);
        y += 3;
      }
      if (invoice.clients?.city && invoice.clients?.state) {
        pdf.text(`${invoice.clients.city}, ${invoice.clients.state} ${invoice.clients.zip_code || ''}`, margin, y);
        y += 3;
      }
      if (invoice.clients?.email) {
        pdf.text(`Email: ${invoice.clients.email}`, margin, y);
        y += 3;
      }
      if (invoice.clients?.phone) {
        pdf.text(`Phone: ${invoice.clients.phone}`, margin, y);
        y += 3;
      }

      y += 6;

      // ===== ITEMS TABLE =====
      // Calculate column widths
      const tableWidth = pageWidth - 2 * margin;
      const colWidths = {
        description: tableWidth * 0.55,
        qty: tableWidth * 0.15,
        rate: tableWidth * 0.15,
        amount: tableWidth * 0.15,
      };

      const colX = {
        description: margin,
        qty: margin + colWidths.description,
        rate: margin + colWidths.description + colWidths.qty,
        amount: margin + colWidths.description + colWidths.qty + colWidths.rate,
      };

      // Table header with bottom border
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "bold");
      pdf.setDrawColor(50, 50, 50);
      pdf.setLineWidth(0.5);

      pdf.text("Description", colX.description + 1, y);
      pdf.text("Qty", colX.qty + colWidths.qty - 1, y, { align: "right" });
      pdf.text("Rate", colX.rate + colWidths.rate - 1, y, { align: "right" });
      pdf.text("Amount", colX.amount + colWidths.amount - 1, y, { align: "right" });

      y += 2;
      pdf.line(margin, y, pageWidth - margin, y);
      y += 4;

      // Table rows
      pdf.setFont("helvetica", "normal");
      invoice.invoice_items.forEach((item: any) => {
        if (y > pageHeight - margin - 30) {
          pdf.addPage();
          y = margin;
        }

        const qtyStr = Number(item.quantity || 0).toFixed(2);
        const rateStr = formatCurrency(item.unit_price || 0);
        const amountStr = formatCurrency(item.line_total || 0);
        
        pdf.text(item.description || 'N/A', colX.description + 1, y);
        pdf.text(qtyStr, colX.qty + colWidths.qty - 1, y, { align: "right" });
        pdf.text(rateStr, colX.rate + colWidths.rate - 1, y, { align: "right" });
        pdf.text(amountStr, colX.amount + colWidths.amount - 1, y, { align: "right" });

        y += 3;
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.2);
        pdf.line(margin, y, pageWidth - margin, y);
        y += 2;
      });

      y += 2;

      // Table footer - Total weight rows
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "bold");
      pdf.text("Total weight (kgs):", colX.description + 1, y);
      pdf.text(totalWeight.toFixed(2), colX.qty + colWidths.qty - 1, y, { align: "right" });
      y += 3;

      if (totalSkinlessWeight > 0) {
        pdf.text("Total skinless weight (kgs):", colX.description + 1, y);
        pdf.text(totalSkinlessWeight.toFixed(2), colX.qty + colWidths.qty - 1, y, { align: "right" });
        y += 3;
      }

      y += 6;

      // ===== TOTALS SECTION (RIGHT ALIGNED) =====
      const totalsWidth = 65;
      const totalsLeftX = pageWidth - margin - totalsWidth;

      // Subtotal
      const subtotalStr = formatCurrency(invoice.subtotal || 0);
      pdf.text("Subtotal:", totalsLeftX, y);
      pdf.text(subtotalStr, pageWidth - margin, y, { align: "right" });
      y += 3;

      // Discount
      if (Number(invoice.discount_amount) > 0) {
        const discountStr = '-' + formatCurrency(invoice.discount_amount);
        pdf.setTextColor(0, 128, 0); // Green
        pdf.text("Discount:", totalsLeftX, y);
        pdf.text(discountStr, pageWidth - margin, y, { align: "right" });
        pdf.setTextColor(0, 0, 0);
        y += 3;
      }

      // Per bird amount
      const perBirdValue = invoice.clients?.value_per_bird ? Number(invoice.clients.value_per_bird) : 0;
      const perBirdAmount = invoice.clients?.enable_per_bird && perBirdValue !== 0 ? totalWeight * perBirdValue : 0;

      if (perBirdAmount !== 0) {
        const perBirdStr = formatCurrency(perBirdAmount);
        pdf.setTextColor(184, 134, 11); // Amber
        pdf.text("", totalsLeftX, y);
        pdf.text(perBirdStr, pageWidth - margin, y, { align: "right" });
        pdf.setTextColor(0, 0, 0);
        y += 3;
      }

      // Total with border
      y += 1;
      pdf.setDrawColor(50, 50, 50);
      pdf.setLineWidth(0.5);
      pdf.line(totalsLeftX - 2, y, pageWidth - margin + 2, y);
      y += 3;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      const totalStr = formatCurrency(invoice.total_amount || 0);
      pdf.text("Total:", totalsLeftX, y);
      pdf.text(totalStr, pageWidth - margin, y, { align: "right" });
      y += 4;

      // Amount paid and balance
      if (Number(invoice.amount_paid) > 0) {
        const paidStr = formatCurrency(invoice.amount_paid);
        const balanceStr = formatCurrency(balance);
        pdf.setFontSize(7);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(0, 128, 0); // Green
        pdf.text("Amount Paid:", totalsLeftX, y);
        pdf.text(paidStr, pageWidth - margin, y, { align: "right" });
        y += 3;

        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.2);
        pdf.line(totalsLeftX - 2, y, pageWidth - margin + 2, y);
        y += 3;

        pdf.setFont("helvetica", "bold");
        if (balance > 0) {
          pdf.setTextColor(220, 53, 69); // Red for due
        } else {
          pdf.setTextColor(34, 197, 94); // Green for paid
        }
        pdf.text("Balance Due:", totalsLeftX, y);
        pdf.text(balanceStr, pageWidth - margin, y, { align: "right" });
        pdf.setTextColor(0, 0, 0);
      }

      y += 10;

      // ===== NOTES =====
      if (invoice.notes) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.text("Notes:", margin, y);
        y += 3;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        const splitNotes = pdf.splitTextToSize(invoice.notes, pageWidth - 2 * margin);
        pdf.text(splitNotes, margin, y);
        y += pdf.getTextDimensions(splitNotes).h + 3;
      }

      // ===== TERMS & CONDITIONS =====
      y += 3;
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.2);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 4;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.text("Terms & Conditions:", margin, y);
      y += 3;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      const splitTerms = pdf.splitTextToSize(activeTemplate.terms_and_conditions, pageWidth - 2 * margin);
      pdf.text(splitTerms, margin, y);
    }

    // Save PDF
    const rangeLabel = fromDate || toDate ? `_${fromDate || "start"}_to_${toDate || "end"}` : "";
    pdf.save(`consolidated_invoices${rangeLabel}_${getTimestamp()}.pdf`);

    toast({
      variant: "success",
      title: "PDF Generated",
      description: `Consolidated PDF with ${validInvoices.length} invoice(s) downloaded successfully.`,
    });
  };

  return (
    <>
      <div className="flex flex-col gap-3 sm:gap-4 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">{toolbarLeft}</div>
          <div className="flex gap-2">
            <Button
              onClick={handleExport}
              size="sm"
              variant="outline"
              title="Export to CSV"
              disabled={processedInvoices.length === 0}
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline ml-2">CSV</span>
            </Button>
            <Button
              onClick={handleExportPDF}
              size="sm"
              variant="outline"
              title="Export to PDF"
              disabled={processedInvoices.length === 0}
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline ml-2">PDF</span>
            </Button>
            <Button
              onClick={handleExportConsolidatedPDF}
              size="sm"
              variant="outline"
              title="Export Consolidated PDF"
              disabled={processedInvoices.length === 0}
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline ml-2">Consolidated</span>
            </Button>
          </div>
        </div>
      </div>

      <>
        <div className="rounded-lg border bg-white overflow-x-auto">
            <Table className="text-xs sm:text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3"
                    onClick={() => handleSort("invoice_number")}
                  >
                    Invoice #<SortIcon column="invoice_number" />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3"
                    onClick={() => handleSort("client")}
                  >
                    Client
                    <SortIcon column="client" />
                  </TableHead>
                  <TableHead
                    className="hidden sm:table-cell cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3"
                    onClick={() => handleSort("issue_date")}
                  >
                    Issue Date
                    <SortIcon column="issue_date" />
                  </TableHead>
                  <TableHead
                    className="hidden md:table-cell cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3"
                    onClick={() => handleSort("due_date")}
                  >
                    Due Date
                    <SortIcon column="due_date" />
                  </TableHead>
                  <TableHead className="hidden lg:table-cell px-2 sm:px-4 py-2 sm:py-3">
                    Overdue
                  </TableHead>
                  <TableHead
                    className="hidden lg:table-cell cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3"
                    onClick={() => handleSort("total_amount")}
                  >
                    Total
                    <SortIcon column="total_amount" />
                  </TableHead>
                  <TableHead
                    className="hidden md:table-cell cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3"
                    onClick={() => handleSort("amount_paid")}
                  >
                    Paid
                    <SortIcon column="amount_paid" />
                  </TableHead>
                  <TableHead
                    className="hidden lg:table-cell cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3"
                    onClick={() => handleSort("due_amount")}
                  >
                    Due
                    <SortIcon column="due_amount" />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3"
                    onClick={() => handleSort("status")}
                  >
                    Status
                    <SortIcon column="status" />
                  </TableHead>
                  <TableHead className="text-right px-2 sm:px-4 py-2 sm:py-3">
                    Actions
                  </TableHead>
                </TableRow>
                <TableRow>
                  <TableHead className="px-2 sm:px-4 py-2 sm:py-3">
                    <Input
                      placeholder="Filter..."
                      value={filters.invoice_number}
                      onChange={(e) =>
                        handleFilterChange("invoice_number", e.target.value)
                      }
                      className="h-7 text-xs"
                    />
                  </TableHead>
                  <TableHead className="px-2 sm:px-4 py-2 sm:py-3">
                    <Input
                      placeholder="Filter..."
                      value={filters.client}
                      onChange={(e) =>
                        handleFilterChange("client", e.target.value)
                      }
                      className="h-7 text-xs"
                    />
                  </TableHead>
                  <TableHead className="hidden sm:table-cell px-2 sm:px-4 py-2 sm:py-3"></TableHead>
                  <TableHead className="hidden md:table-cell px-2 sm:px-4 py-2 sm:py-3"></TableHead>
                  <TableHead className="hidden lg:table-cell px-2 sm:px-4 py-2 sm:py-3"></TableHead>
                  <TableHead className="hidden lg:table-cell px-2 sm:px-4 py-2 sm:py-3"></TableHead>
                  <TableHead className="hidden md:table-cell px-2 sm:px-4 py-2 sm:py-3"></TableHead>
                  <TableHead className="hidden lg:table-cell px-2 sm:px-4 py-2 sm:py-3"></TableHead>
                  <TableHead className="px-2 sm:px-4 py-2 sm:py-3">
                    <Input
                      placeholder="Filter..."
                      value={filters.status}
                      onChange={(e) =>
                        handleFilterChange("status", e.target.value)
                      }
                      className="h-7 text-xs"
                    />
                  </TableHead>
                  <TableHead className="px-2 sm:px-4 py-2 sm:py-3"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagination.paginatedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-12">
                      No invoices found for the selected filters.
                    </TableCell>
                  </TableRow>
                ) : pagination.paginatedItems.map((invoice) => {
                  const config =
                    statusConfig[invoice.status as keyof typeof statusConfig];
                  const balance =
                    Number(invoice.total_amount) - Number(invoice.amount_paid);

                  // Overdue categorization
                  const dueDate = new Date(invoice.due_date);
                  const today = new Date();
                  const msInDay = 1000 * 60 * 60 * 24;
                  const daysOverdue = Math.floor(
                    (today.getTime() - dueDate.getTime()) / msInDay,
                  );
                  const isOverdue = balance > 0 && daysOverdue > 0;
                  let overdueLabel = "On time";
                  let overdueClass = "bg-emerald-100 text-emerald-800";

                  if (isOverdue) {
                    if (daysOverdue <= 7) {
                      overdueLabel = "1 week";
                      overdueClass = "bg-amber-100 text-amber-800";
                    } else if (daysOverdue <= 14) {
                      overdueLabel = "2 weeks";
                      overdueClass = "bg-orange-100 text-orange-800";
                    } else if (daysOverdue <= 21) {
                      overdueLabel = "3 weeks";
                      overdueClass = "bg-red-100 text-red-800";
                    } else {
                      overdueLabel = "3+ weeks";
                      overdueClass = "bg-red-200 text-red-900";
                    }
                  }

                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium px-2 sm:px-4 py-2 sm:py-3 max-w-[100px] sm:max-w-none truncate">
                        {invoice.invoice_number}
                      </TableCell>
                      <TableCell className="px-2 sm:px-4 py-2 sm:py-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-xs sm:text-sm">
                            {invoice.clients.name}
                          </span>
                          <span className="text-xs text-muted-foreground hidden sm:inline">
                            {invoice.clients.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell px-2 sm:px-4 py-2 sm:py-3 text-xs">
                        {new Date(invoice.issue_date).toLocaleDateString(
                          "en-IN",
                          { year: "numeric", month: "2-digit", day: "2-digit" },
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell px-2 sm:px-4 py-2 sm:py-3 text-xs">
                        {invoice.due_days_type === "end_of_month" ? (
                          <span className="text-blue-600 font-semibold">
                            End of the billed month
                          </span>
                        ) : (
                          new Date(invoice.due_date).toLocaleDateString(
                            "en-IN",
                            {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                            },
                          )
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell px-2 sm:px-4 py-2 sm:py-3">
                        <Badge
                          variant="secondary"
                          className={`${overdueClass} text-xs`}
                        >
                          {overdueLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell font-medium px-2 sm:px-4 py-2 sm:py-3 text-xs">
                        ₹
                        {Number(invoice.total_amount).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-green-600 px-2 sm:px-4 py-2 sm:py-3 text-xs">
                        ₹
                        {Number(invoice.amount_paid).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell
                        className={`hidden lg:table-cell px-2 sm:px-4 py-2 sm:py-3 text-xs ${balance > 0 ? "font-semibold text-orange-600" : "text-green-600"}`}
                      >
                        ₹
                        {balance.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="px-2 sm:px-4 py-2 sm:py-3">
                        <Badge
                          variant="secondary"
                          className={`${config.className} text-xs`}
                        >
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right px-2 sm:px-4 py-2 sm:py-3">
                        <div className="flex justify-end gap-1 sm:gap-2">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/dashboard/invoices/${invoice.id}`}>
                              <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                            </Link>
                          </Button>
                          {userRole !== "accountant" &&
                            (invoice.status === "draft" ||
                              invoice.status === "recorded") && (
                            <Button variant="ghost" size="sm" asChild>
                              <Link
                                href={`/dashboard/invoices/${invoice.id}/edit`}
                              >
                                <Pencil className="h-3 w-3 sm:h-4 sm:w-4" />
                              </Link>
                            </Button>
                          )}
                          {userRole !== "accountant" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setInvoiceToDelete(invoice.id);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 text-red-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {processedInvoices.length > 0 && (
            <TablePagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={pagination.goToPage}
              onItemsPerPageChange={setItemsPerPage}
            />
          )}
        </>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this
              invoice and all associated items.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
