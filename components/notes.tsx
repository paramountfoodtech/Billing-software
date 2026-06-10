"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { MessageSquare, Send } from "lucide-react"
import { formatIndianDate } from "@/lib/date-time"

interface Note {
  id: string
  note: string
  created_at: string
  profiles: {
    full_name: string
    role: string
  } | null
}

type NoteReferenceType =
  | "invoice"
  | "payment"
  | "purchase_invoice"
  | "purchase_payment"

interface NotesProps {
  notes: Note[]
  referenceId: string
  referenceType: NoteReferenceType
  userRole?: string
}

const NOTE_CONFIG: Record<
  NoteReferenceType,
  { table: string; foreignKey: string }
> = {
  invoice: { table: "invoice_notes", foreignKey: "invoice_id" },
  payment: { table: "payment_notes", foreignKey: "payment_id" },
  purchase_invoice: {
    table: "purchase_invoice_notes",
    foreignKey: "purchase_invoice_id",
  },
  purchase_payment: {
    table: "purchase_payment_notes",
    foreignKey: "purchase_payment_id",
  },
}

export function Notes({
  notes: initialNotes,
  referenceId,
  referenceType,
  userRole,
}: NotesProps) {
  const [notes, setNotes] = useState<Note[]>(initialNotes)
  const [newNote, setNewNote] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  const { table: tableName, foreignKey } = NOTE_CONFIG[referenceType]
  const canAddNotes = userRole === "super_admin" || userRole === "admin"

  const hydrateNotesWithProfiles = async (
    fetchedNotes: Array<{
      id: string
      note: string
      created_at: string
      created_by: string
    }>,
  ) => {
    if (fetchedNotes.length === 0) {
      setNotes([])
      return
    }

    const createdByIds = fetchedNotes.map((note) => note.created_by)
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .in("id", createdByIds)

    const notesWithProfiles = fetchedNotes
      .map((note) => {
        const profile = profiles?.find((p) => p.id === note.created_by)
        return {
          id: note.id,
          note: note.note,
          created_at: note.created_at,
          profiles: profile
            ? {
                full_name: profile.full_name,
                role: profile.role,
              }
            : null,
        }
      })
      .filter((note) => note.profiles !== null) as Note[]

    setNotes(notesWithProfiles)
  }

  useEffect(() => {
    const channel = supabase
      .channel(`${tableName}-${referenceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: tableName,
          filter: `${foreignKey}=eq.${referenceId}`,
        },
        async () => {
          const { data: updatedNotes } = await supabase
            .from(tableName)
            .select("id, note, created_at, created_by")
            .eq(foreignKey, referenceId)
            .order("created_at", { ascending: false })

          if (updatedNotes) {
            await hydrateNotesWithProfiles(updatedNotes)
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [referenceId, tableName, foreignKey, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newNote.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a note before submitting.",
      })
      return
    }

    setIsSubmitting(true)

    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You must be logged in to add notes.",
      })
      setIsSubmitting(false)
      return
    }

    const { error } = await supabase.from(tableName).insert({
      [foreignKey]: referenceId,
      created_by: userData.user.id,
      note: newNote.trim(),
    })

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add note. Please try again.",
      })
    } else {
      toast({
        variant: "success",
        title: "Note added",
        description: "Your note has been added successfully.",
      })
      setNewNote("")

      const { data: fetchedNotes } = await supabase
        .from(tableName)
        .select("id, note, created_at, created_by")
        .eq(foreignKey, referenceId)
        .order("created_at", { ascending: false })

      if (fetchedNotes) {
        await hydrateNotesWithProfiles(fetchedNotes)
      }
    }

    setIsSubmitting(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Notes & Comments
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canAddNotes && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <Textarea
              placeholder="Add a note or comment..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={3}
              disabled={isSubmitting}
              className="resize-none"
            />
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={isSubmitting || !newNote.trim()}
                size="sm"
              >
                <Send className="h-4 w-4 mr-2" />
                {isSubmitting ? "Adding..." : "Add Note"}
              </Button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {notes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No notes yet. {canAddNotes && "Be the first to add one!"}
            </div>
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                className="border rounded-lg p-4 space-y-2 bg-muted/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {note.profiles?.full_name || "Unknown User"}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {note.profiles?.role || "Unknown"}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatIndianDate(note.created_at, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{note.note}</p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
