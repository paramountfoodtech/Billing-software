"use client"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreVertical, Send, CheckCircle, XCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useToast } from "@/hooks/use-toast"

interface InvoiceActionsProps {
  invoiceId: string
  currentStatus: string
}

export function InvoiceActions({ invoiceId, currentStatus }: InvoiceActionsProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isUpdating, setIsUpdating] = useState(false)

  const updateStatus = async (newStatus: string) => {
    setIsUpdating(true)
    const supabase = createClient()

    const { error } = await supabase.from("invoices").update({ status: newStatus }).eq("id", invoiceId)

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update invoice status",
      })
    } else {
      toast({
        title: "Success",
        description: "Invoice status updated successfully.",
      })
      router.refresh()
    }

    setIsUpdating(false)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isUpdating}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {currentStatus === "draft" && (
          <DropdownMenuItem onClick={() => updateStatus("sent")}>
            <Send className="h-4 w-4 mr-2" />
            Mark as Sent
          </DropdownMenuItem>
        )}
        {(currentStatus === "sent" || currentStatus === "overdue") && (
          <DropdownMenuItem onClick={() => updateStatus("paid")}>
            <CheckCircle className="h-4 w-4 mr-2" />
            Mark as Paid
          </DropdownMenuItem>
        )}
        {currentStatus !== "cancelled" && (
          <DropdownMenuItem onClick={() => updateStatus("cancelled")} className="text-red-600">
            <XCircle className="h-4 w-4 mr-2" />
            Cancel Invoice
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
