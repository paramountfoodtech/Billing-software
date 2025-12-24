"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useToast } from "@/hooks/use-toast"
import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  Banknote,
  BarChart3,
  LogOut,
  Menu,
  X,
  Settings,
  Briefcase,
  CreditCard,
  Tag,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useState } from "react"

interface Profile {
  id: string
  email: string
  full_name: string
  role: string
}

interface DashboardNavProps {
  profile: Profile | null
}

export function DashboardNav({ profile }: DashboardNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { toast } = useToast()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null)

  const handleSignOut = async () => {
    setIsSigningOut(true)
    const supabase = createClient()
    
    try {
      await supabase.auth.signOut()
      toast({
        title: "Signed out",
        description: "You have been successfully signed out.",
      })
      router.push("/auth/login")
      router.refresh()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Sign out failed",
        description: error instanceof Error ? error.message : "An error occurred",
      })
    } finally {
      setIsSigningOut(false)
    }
  }

  const handleNavigation = (href: string) => {
    setNavigatingTo(href)
    setIsMobileMenuOpen(false)
    // Reset loading state after navigation
    setTimeout(() => setNavigatingTo(null), 300)
  }

  const getNavItemsForRole = (role: string | undefined) => {
    const allNavItems = [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "manager"] },
      { href: "/dashboard/users", label: "Team", icon: Users, roles: ["admin", "manager"] },
      { href: "/dashboard/clients", label: "Clients", icon: Briefcase, roles: ["admin", "accountant", "manager"] },
      { href: "/dashboard/products", label: "Products", icon: Package, roles: ["admin", "accountant", "manager"] },
      {
        href: "/dashboard/prices",
        label: "Prices",
        icon: Tag,
        roles: ["admin", "accountant", "manager"],
      },
      {
        href: "/dashboard/client-pricing",
        label: "Pricing Rules",
        icon: CreditCard,
        roles: ["admin", "manager"],
      },
      { href: "/dashboard/invoices", label: "Invoices", icon: FileText, roles: ["admin", "accountant", "manager"] },
      {
        href: "/dashboard/payments",
        label: "Payments",
        icon: Banknote,
        roles: ["admin", "accountant", "manager"],
      },
      { href: "/dashboard/reports", label: "Reports", icon: BarChart3, roles: ["admin", "manager"] },
      { href: "/dashboard/settings", label: "Settings", icon: Settings, roles: ["admin", "manager"] },
    ]

    return allNavItems.filter((item) => item.roles.includes(role || "accountant"))
  }

  const navItems = getNavItemsForRole(profile?.role)

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-md shadow-md"
      >
        {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:sticky lg:top-0 inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 lg:h-screen",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <Image
              src="/BS%20Logo.jpeg"
              alt="Billing Management System logo"
              width={44}
              height={44}
              className="h-11 w-11 rounded-lg object-cover shadow-sm"
              priority
            />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Invoice Pro</h1>
              <p className="text-sm text-slate-500 mt-1">{profile?.full_name}</p>
              <p className="text-xs text-slate-400 capitalize">{profile?.role?.replace("_", " ")}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
            const isLoading = navigatingTo === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => handleNavigation(item.href)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors relative",
                  isActive ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                  isLoading && "opacity-70",
                )}
              >
                {isLoading ? <Spinner className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-slate-200">
          <Button onClick={handleSignOut} variant="outline" className="w-full justify-start bg-transparent" size="sm" disabled={isSigningOut}>
            {isSigningOut ? <Spinner className="h-4 w-4 mr-2" /> : <LogOut className="h-4 w-4 mr-2" />}
            {isSigningOut ? "Signing out..." : "Sign Out"}
          </Button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-30" onClick={() => setIsMobileMenuOpen(false)} />
      )}
    </>
  )
}
