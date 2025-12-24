import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/components/ui/toaster"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Invoice Pro - Billing Management System",
  description: "Professional billing and invoice management system for businesses",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/BS%20Logo.jpeg",
        rel: "icon",
        type: "image/jpeg",
      },
    ],
    shortcut: "/BS%20Logo.jpeg",
    apple: "/BS%20Logo.jpeg",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        {children}
        <Toaster />
        <Analytics />
      </body>
    </html>
  )
}
