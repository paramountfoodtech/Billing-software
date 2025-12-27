"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Trash2, ExternalLink } from "lucide-react"
import { useRouter } from "next/navigation"

interface Notification {
  id: string
  type: string
  title: string
  message: string
  reference_id: string
  reference_type: string
  is_read: boolean
  created_at: string
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        fetchNotifications(user.id)
      }
    }
    fetchUser()
  }, [supabase])

  const fetchNotifications = async (id: string) => {
    setLoading(true)
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", id)
      .order("created_at", { ascending: false })

    if (data) {
      setNotifications(data)
    }
    setLoading(false)
  }

  const markAsRead = async (notificationId: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", notificationId)
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n)),
    )
  }

  const deleteNotification = async (notificationId: string) => {
    await supabase.from("notifications").delete().eq("id", notificationId)
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId))
  }

  const markAllAsRead = async () => {
    if (!userId) return
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false)

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  const getNotificationLink = (notification: Notification) => {
    if (notification.reference_type === "invoice") {
      return `/dashboard/invoices/${notification.reference_id}`
    } else if (notification.reference_type === "payment") {
      return `/dashboard/payments/${notification.reference_id}`
    }
    return "#"
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <div className="lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6\">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" onClick={markAllAsRead} size="sm">
              Mark All as Read
            </Button>
          )}
        </div>

        {/* Notifications List */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground mb-4">No notifications yet</p>
            <Button asChild>
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <Card
                key={notification.id}
                className={`p-4 transition-colors ${
                  !notification.is_read ? "bg-blue-50 border-blue-200" : ""
                }`}
              >
                <div className="flex gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-slate-900">{notification.title}</h3>
                      {!notification.is_read && (
                        <Badge className="bg-blue-600">New</Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 mb-3">{notification.message}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {new Date(notification.created_at).toLocaleDateString("en-IN", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <div className="flex items-center gap-2">
                        {!notification.is_read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                          >
                            Mark as read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Link
                      href={getNotificationLink(notification)}
                      className="text-blue-600 hover:text-blue-700 p-2 hover:bg-blue-100 rounded-lg transition-colors"
                      title="View"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                    <button
                      onClick={() => deleteNotification(notification.id)}
                      className="text-slate-400 hover:text-red-600 p-2 hover:bg-red-100 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
