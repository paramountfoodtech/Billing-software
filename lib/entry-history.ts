import type { SupabaseClient } from "@supabase/supabase-js"
import { formatIndianDateTime } from "@/lib/date-time"

export type EntryEntityType =
  | "invoice"
  | "payment"
  | "client"
  | "product"
  | "price_category"
  | "price_history"
  | "client_pricing"

export type EntryHistoryAction = "created" | "updated"

export type EntryHistoryRow = {
  id: string
  action: EntryHistoryAction
  user_name: string | null
  occurred_at: string
  summary: string | null
}

export type LogEntryHistoryParams = {
  organizationId: string
  entityType: EntryEntityType
  entityId: string
  action: EntryHistoryAction
  userId: string
  userName: string
  summary?: string
}

export async function getProfileDisplayName(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle()
  return data?.full_name?.trim() || "Unknown user"
}

export async function logEntryHistory(
  supabase: SupabaseClient,
  params: LogEntryHistoryParams,
): Promise<void> {
  try {
    const { error } = await supabase.from("entry_history").insert({
      organization_id: params.organizationId,
      entity_type: params.entityType,
      entity_id: params.entityId,
      action: params.action,
      user_id: params.userId,
      user_name: params.userName,
      summary: params.summary ?? null,
    })
    if (error) {
      console.warn("Failed to log entry history:", error.message)
    }
  } catch (err) {
    console.warn("Failed to log entry history:", err)
  }
}

export async function fetchEntryHistory(
  supabase: SupabaseClient,
  entityType: EntryEntityType,
  entityId: string,
): Promise<EntryHistoryRow[]> {
  const { data, error } = await supabase
    .from("entry_history")
    .select("id, action, user_name, occurred_at, summary")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("occurred_at", { ascending: false })

  if (error) {
    console.warn("Failed to fetch entry history:", error.message)
    return []
  }

  return (data || []) as EntryHistoryRow[]
}

export function formatHistoryTimestamp(iso: string): string {
  return formatIndianDateTime(iso)
}

export function actionLabel(action: EntryHistoryAction): string {
  return action === "created" ? "Created" : "Updated"
}
