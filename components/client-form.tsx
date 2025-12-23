"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useState } from "react"

interface Client {
  id: string
  name: string
  email: string
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  country: string | null
  notes: string | null
  due_days?: number | null
  value_per_bird?: number | null
}

interface ClientFormProps {
  client?: Client
}

export function ClientForm({ client }: ClientFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [fetchingPincode, setFetchingPincode] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: client?.name || "",
    email: client?.email || "",
    phone: client?.phone || "",
    address: client?.address || "",
    city: client?.city || "",
    state: client?.state || "",
    zip_code: client?.zip_code || "",
    country: client?.country || "India",
    notes: client?.notes || "",
    due_days: client?.due_days?.toString() || "30",
    value_per_bird: client?.value_per_bird?.toString() || "0",
  })

  const handlePincodeChange = async (pincode: string) => {
    setFormData({ ...formData, zip_code: pincode })

    // Only fetch if pincode is 6 digits (Indian pincode format)
    if (pincode.length === 6 && /^\d{6}$/.test(pincode)) {
      setFetchingPincode(true)
      try {
        const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`)
        const data = await response.json()
        
        if (data[0]?.Status === "Success" && data[0]?.PostOffice?.length > 0) {
          const postOffice = data[0].PostOffice[0]
          setFormData(prev => ({
            ...prev,
            city: postOffice.District || prev.city,
            state: postOffice.State || prev.state,
            country: "India",
          }))
        }
      } catch (err) {
        console.error("Error fetching pincode data:", err)
      } finally {
        setFetchingPincode(false)
      }
    }
  }

  const countries = [
    "India",
    "USA",
    "United Kingdom",
    "Canada",
    "Australia",
    "Singapore",
    "UAE",
    "Other",
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const supabase = createClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication required",
        description: "You must be logged in to perform this action.",
      })
      setIsLoading(false)
      return
    }

    try {
      // Get user's organization
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

      if (!profile?.organization_id) {
        throw new Error("User must belong to an organization")
      }

      const dueDays = Number(formData.due_days) || 0
      const valuePerBirdRaw = formData.value_per_bird.trim()
      const valuePerBird = valuePerBirdRaw === "" ? 0 : Number(valuePerBirdRaw)

      if (Number.isNaN(valuePerBird)) {
        toast({
          variant: "destructive",
          title: "Invalid per-bird value",
          description: "Please enter a valid number (can be negative).",
        })
        setIsLoading(false)
        return
      }

      if (client) {
        // Update existing client
        const { error } = await supabase
          .from("clients")
          .update({ ...formData, due_days: dueDays, value_per_bird: valuePerBird })
          .eq("id", client.id)

        if (error) throw error
        
        toast({
          title: "Client updated",
          description: "Client information has been updated successfully.",
        })
      } else {
        // Create new client
        const { error } = await supabase
          .from("clients")
          .insert({
            ...formData,
            due_days: dueDays,
            value_per_bird: valuePerBird,
            created_by: user.id,
            organization_id: profile.organization_id,
          })

        if (error) throw error
        
        toast({
          title: "Client created",
          description: `${formData.name} has been added successfully.`,
        })
      }

      router.push("/dashboard/clients")
      router.refresh()
    } catch (error: unknown) {
      let errorMessage = "An unexpected error occurred. Please try again."
      
      if (error instanceof Error) {
        if (error.message.includes('duplicate') || error.message.includes('unique')) {
          errorMessage = "A client with this email already exists in your organization."
        } else if (error.message.includes('organization')) {
          errorMessage = "Organization error: Please contact support."
        } else {
          errorMessage = error.message
        }
      }
      
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">
                Client Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="ABC Corporation"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="contact@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91 98765 43210"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_days">Due days to pay</Label>
              <Input
                id="due_days"
                type="number"
                min="0"
                step="1"
                value={formData.due_days}
                onChange={(e) => setFormData({ ...formData, due_days: e.target.value })}
                placeholder="30"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="value_per_bird">Value per bird (₹)</Label>
              <Input
                id="value_per_bird"
                type="number"
                step="0.01"
                value={formData.value_per_bird}
                onChange={(e) => setFormData({ ...formData, value_per_bird: e.target.value })}
                placeholder="e.g., 1.50 or -0.75"
              />
              <p className="text-xs text-muted-foreground">Positive adds charge per bird; negative applies discount.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Select value={formData.country} onValueChange={(value) => setFormData({ ...formData, country: value })}>
                <SelectTrigger id="country">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {countries.map((country) => (
                    <SelectItem key={country} value={country}>
                      {country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="123 Main Street"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="zip_code">Pincode</Label>
              <div className="relative">
                <Input
                  id="zip_code"
                  value={formData.zip_code}
                  onChange={(e) => handlePincodeChange(e.target.value)}
                  placeholder="400001"
                  maxLength={6}
                  disabled={fetchingPincode}
                />
                {fetchingPincode && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Spinner className="h-4 w-4" />
                  </div>
                )}
              </div>
              {fetchingPincode && <p className="text-xs text-blue-600 flex items-center gap-1">
                <Spinner className="h-3 w-3" />
                Fetching location...
              </p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Mumbai"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                placeholder="Maharashtra"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional information about this client..."
              rows={4}
            />
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="submit" disabled={isLoading || fetchingPincode} className="min-w-32">
              {isLoading ? (
                <>
                  <Spinner className="mr-2" />
                  {client ? "Updating..." : "Creating..."}
                </>
              ) : (
                <>{client ? "Update Client" : "Create Client"}</>
              )}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={isLoading}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
