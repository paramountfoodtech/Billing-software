import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/components/ui/toaster"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Paramount Food Tech",
  description: "Pioneering excellence in food processing",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/PFT logo.png",
        rel: "icon",
        type: "image/jpeg",
      },
    ],
    shortcut: "/PFT logo.png",
    apple: "/PFT logo.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`font-sans antialiased h-full`}>
        {children}
        <Toaster />
        <Analytics />
      </body>
    </html>
  )
}
