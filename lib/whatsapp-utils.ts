/** Normalize phone for WhatsApp (digits only, India default country code). */
export function normalizeWhatsAppPhone(
  phone: string | null | undefined,
): string | null {
  if (!phone?.trim()) return null;

  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.length === 10) {
    digits = `91${digits}`;
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = `91${digits.slice(1)}`;
  }

  return digits;
}

function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * Official click-to-chat URL.
 * Opens the conversation with that phone (desktop app or WhatsApp Web) — not just the home screen.
 */
export function buildWhatsAppChatUrl(
  phone: string | null | undefined,
  message: string,
): string | null {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized) return null;
  return `https://api.whatsapp.com/send?phone=${normalized}&text=${encodeURIComponent(message)}`;
}

function canShareFiles(files: File[]) {
  if (typeof navigator === "undefined" || !navigator.share || !navigator.canShare) {
    return false;
  }
  try {
    return navigator.canShare({ files });
  } catch {
    return false;
  }
}

/**
 * Share a file via the system share sheet (mobile only).
 * macOS share sheet usually does not list WhatsApp.
 */
export async function shareFileViaSystem(
  file: File,
  message: string,
): Promise<boolean> {
  if (!isMobileDevice() || !canShareFiles([file])) return false;

  try {
    await navigator.share({ files: [file], text: message });
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return true;
    }
    return false;
  }
}

/**
 * Open WhatsApp with the registered contact + message ready to send.
 * Uses api.whatsapp.com/send so the chat for that number opens (not only the app home).
 */
export function openWhatsAppChat(
  phone: string | null | undefined,
  message: string,
): boolean {
  const chatUrl = buildWhatsAppChatUrl(phone, message);
  if (!chatUrl) return false;

  if (isMobileDevice()) {
    window.location.assign(chatUrl);
  } else {
    // New tab/window: Mac will offer to open in WhatsApp Desktop if installed,
    // otherwise WhatsApp Web with the contact chat ready.
    window.open(chatUrl, "_blank", "noopener,noreferrer");
  }

  return true;
}

export type WhatsAppShareResult =
  | { method: "system-share" }
  | { method: "chat-url"; needsManualAttach: boolean };

/**
 * Share an invoice on WhatsApp.
 * - Mobile: system share (pick contact + PDF attached).
 * - Mac/desktop: open chat with registered contact pre-selected; PDF downloads for attach.
 */
export async function shareInvoiceOnWhatsApp(options: {
  phone: string | null | undefined;
  message: string;
  pdfBlob: Blob;
  pdfFilename: string;
}): Promise<WhatsAppShareResult | null> {
  const { phone, message, pdfBlob, pdfFilename } = options;
  const file = new File([pdfBlob], pdfFilename, { type: "application/pdf" });

  if (isMobileDevice() && canShareFiles([file])) {
    const shared = await shareFileViaSystem(file, message);
    if (shared) {
      return { method: "system-share" };
    }
  }

  const opened = openWhatsAppChat(phone, message);
  if (!opened) return null;

  return { method: "chat-url", needsManualAttach: true };
}
