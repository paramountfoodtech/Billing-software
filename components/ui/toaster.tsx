'use client'

import { useToast } from '@/hooks/use-toast'
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast'

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const hasContent = Boolean(title) || Boolean(description)
        const fallbackTitle = props.variant === "destructive" ? "Error" : "Notice"
        const fallbackDescription = props.variant === "destructive" ? "Something went wrong." : "Action completed."

        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {(title || !hasContent) && <ToastTitle>{title || fallbackTitle}</ToastTitle>}
              {(description || !hasContent) && (
                <ToastDescription>{description || fallbackDescription}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
