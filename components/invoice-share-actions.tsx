"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { IconTooltip } from "@/components/icon-tooltip";
import { useToast } from "@/hooks/use-toast";
import { Mail } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import {
  blobToBase64,
  downloadPdfBlob,
  generateInvoicePdfFromElement,
} from "@/lib/invoice-pdf-client";
import { shareInvoiceOnWhatsApp } from "@/lib/whatsapp-utils";

type InvoiceShareActionsProps = {
  invoiceType: "sales" | "purchase";
  invoiceId: string;
  invoiceNumber: string;
  recipientName: string;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  companyName?: string;
  printAreaId?: string;
};

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export function InvoiceShareActions({
  invoiceType,
  invoiceId,
  invoiceNumber,
  recipientName,
  recipientEmail,
  recipientPhone,
  companyName = "Paramount Food Tech",
  printAreaId = "invoice-print-area",
}: InvoiceShareActionsProps) {
  const { toast } = useToast();
  const [isSharingWhatsApp, setIsSharingWhatsApp] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const pdfFilename =
    invoiceType === "purchase"
      ? `purchase-invoice-${invoiceNumber.replace(/\s+/g, "-")}.pdf`
      : `invoice-${invoiceNumber.replace(/\s+/g, "-")}.pdf`;

  const getPrintElement = () => document.getElementById(printAreaId);

  const generatePdf = async () => {
    const element = getPrintElement();
    if (!element) {
      throw new Error("Invoice content not found. Please refresh and try again.");
    }
    return generateInvoicePdfFromElement(element, pdfFilename);
  };

  const handleWhatsApp = async () => {
    if (!recipientPhone?.trim()) {
      toast({
        variant: "destructive",
        title: "No phone number",
        description: `No phone number is registered for ${recipientName}.`,
      });
      return;
    }

    setIsSharingWhatsApp(true);
    try {
      const { blob, filename } = await generatePdf();
      const message = `Hello ${recipientName},\n\nPlease find invoice ${invoiceNumber} from ${companyName}.`;

      const result = await shareInvoiceOnWhatsApp({
        phone: recipientPhone,
        message,
        pdfBlob: blob,
        pdfFilename: filename,
      });

      if (!result) {
        toast({
          variant: "destructive",
          title: "Invalid phone number",
          description: "Could not open WhatsApp with the registered phone number.",
        });
        return;
      }

      if (result.method === "system-share") {
        toast({
          variant: "success",
          title: "Share sheet opened",
          description: "Choose WhatsApp, pick the contact, and send the attached PDF.",
        });
        return;
      }

      downloadPdfBlob(blob, filename);
      toast({
        variant: "success",
        title: "WhatsApp chat opened",
        description: `Chat with ${recipientName} is ready. Attach the downloaded PDF with the paperclip icon, then send.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "WhatsApp share failed",
        description:
          error instanceof Error ? error.message : "Failed to prepare invoice PDF.",
      });
    } finally {
      setIsSharingWhatsApp(false);
    }
  };

  const handleEmail = async () => {
    if (!recipientEmail?.trim()) {
      toast({
        variant: "destructive",
        title: "No email address",
        description: `No email is registered for ${recipientName}.`,
      });
      return;
    }

    setIsSendingEmail(true);
    try {
      const { blob, filename } = await generatePdf();
      const pdfBase64 = await blobToBase64(blob);

      const response = await fetch("/api/email/send-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceType,
          invoiceId,
          pdfBase64,
          filename,
          companyName,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to send email");
      }

      toast({
        variant: "success",
        title: "Email sent",
        description: `Invoice sent to ${result.sentTo || recipientEmail}.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Email failed",
        description:
          error instanceof Error ? error.message : "Failed to send invoice email.",
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <IconTooltip label="Share via WhatsApp">
        <Button
          variant="outline"
          onClick={handleWhatsApp}
          disabled={isSharingWhatsApp || isSendingEmail}
          className="text-green-700 border-green-200 hover:bg-green-50"
        >
          {isSharingWhatsApp ? (
            <Spinner className="h-4 w-4 mr-2" />
          ) : (
            <WhatsAppIcon className="h-4 w-4 mr-2" />
          )}
          {isSharingWhatsApp ? "Preparing..." : "WhatsApp"}
        </Button>
      </IconTooltip>
      <IconTooltip label={`Email to ${recipientEmail || "registered contact"}`}>
        <Button
          variant="outline"
          onClick={handleEmail}
          disabled={isSendingEmail || isSharingWhatsApp}
        >
          {isSendingEmail ? (
            <Spinner className="h-4 w-4 mr-2" />
          ) : (
            <Mail className="h-4 w-4 mr-2" />
          )}
          {isSendingEmail ? "Sending..." : "Email"}
        </Button>
      </IconTooltip>
    </div>
  );
}
