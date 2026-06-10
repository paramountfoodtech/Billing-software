"use client";

import type React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import {
  getProfileDisplayName,
  logEntryHistory,
} from "@/lib/entry-history";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface Purchaser {
  id: string;
  purchaser_code: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
  notes: string | null;
}

interface PurchaserFormProps {
  purchaser?: Purchaser;
  suggestedCode?: string;
}

export function PurchaserForm({ purchaser, suggestedCode }: PurchaserFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [fetchingPincode, setFetchingPincode] = useState(false);

  const [formData, setFormData] = useState({
    purchaser_code: purchaser?.purchaser_code || suggestedCode || "",
    name: purchaser?.name || "",
    email: purchaser?.email || "",
    phone: purchaser?.phone || "",
    address: purchaser?.address || "",
    city: purchaser?.city || "",
    state: purchaser?.state || "",
    zip_code: purchaser?.zip_code || "",
    country: purchaser?.country || "India",
    notes: purchaser?.notes || "",
  });

  const handlePincodeChange = async (pincode: string) => {
    const digitsOnly = pincode.replace(/\D/g, "").slice(0, 6);
    setFormData({ ...formData, zip_code: digitsOnly });

    if (digitsOnly.length === 6 && /^\d{6}$/.test(digitsOnly)) {
      setFetchingPincode(true);
      try {
        const response = await fetch(
          `https://api.postalpincode.in/pincode/${digitsOnly}`,
        );
        const data = await response.json();
        if (data[0]?.Status === "Success" && data[0]?.PostOffice?.length > 0) {
          const postOffice = data[0].PostOffice[0];
          setFormData((prev) => ({
            ...prev,
            city: postOffice.District || prev.city,
            state: postOffice.State || prev.state,
            country: "India",
          }));
        }
      } catch {
        // silently fail
      } finally {
        setFetchingPincode(false);
      }
    }
  };

  const countries = [
    "India",
    "USA",
    "United Kingdom",
    "Canada",
    "Australia",
    "Singapore",
    "UAE",
    "Other",
  ];
  const countryOptions = countries.map((c) => ({ value: c, label: c }));

  const handlePhoneChange = (value: string) => {
    const digitsOnly = value.replace(/\D/g, "").slice(0, 10);
    setFormData((prev) => ({ ...prev, phone: digitsOnly }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication required",
        description: "You must be logged in to perform this action.",
      });
      setIsLoading(false);
      return;
    }

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single();

      if (!profile?.organization_id) {
        throw new Error("User must belong to an organization");
      }

      if (!formData.purchaser_code.trim()) {
        toast({
          variant: "destructive",
          title: "Missing purchaser ID",
          description: "Please enter a unique purchaser ID.",
        });
        setIsLoading(false);
        return;
      }

      if (!formData.name.trim()) {
        toast({
          variant: "destructive",
          title: "Missing name",
          description: "Please enter the purchaser name.",
        });
        setIsLoading(false);
        return;
      }

      if (purchaser) {
        const { error } = await supabase
          .from("purchasers")
          .update({
            ...formData,
            email: formData.email || null,
            phone: formData.phone || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", purchaser.id);

        if (error) throw error;

        const userName = await getProfileDisplayName(supabase, user.id);
        await logEntryHistory(supabase, {
          organizationId: profile.organization_id,
          entityType: "purchaser",
          entityId: purchaser.id,
          action: "updated",
          userId: user.id,
          userName,
        });

        toast({
          variant: "success",
          title: "Purchaser updated",
          description: "Purchaser information has been updated successfully.",
        });
      } else {
        const { data: created, error } = await supabase
          .from("purchasers")
          .insert({
            ...formData,
            email: formData.email || null,
            phone: formData.phone || null,
            created_by: user.id,
            organization_id: profile.organization_id,
          })
          .select("id")
          .single();

        if (error) throw error;

        const userName = await getProfileDisplayName(supabase, user.id);
        if (created?.id) {
          await logEntryHistory(supabase, {
            organizationId: profile.organization_id,
            entityType: "purchaser",
            entityId: created.id,
            action: "created",
            userId: user.id,
            userName,
          });
        }

        toast({
          variant: "success",
          title: "Purchaser created",
          description: `${formData.name} has been added successfully.`,
        });
      }

      router.push("/dashboard/purchasers");
      router.refresh();
    } catch (error: unknown) {
      let errorMessage = "An unexpected error occurred. Please try again.";
      if (error instanceof Error) {
        if (
          error.message.includes("duplicate") ||
          error.message.includes("unique")
        ) {
          errorMessage =
            "A purchaser with this ID already exists in your organization.";
        } else {
          errorMessage = error.message;
        }
      }
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="purchaser_code">
                Purchaser ID <span className="text-red-500">*</span>
              </Label>
              <Input
                id="purchaser_code"
                required
                value={formData.purchaser_code}
                placeholder="PUR-001"
                disabled
                readOnly
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Vendor name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="contact@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="10-digit phone"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              placeholder="Street address"
              rows={2}
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
                  placeholder="6-digit pincode"
                />
                {fetchingPincode && (
                  <Spinner className="absolute right-2 top-2 h-4 w-4" />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) =>
                  setFormData({ ...formData, city: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) =>
                  setFormData({ ...formData, state: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <SearchableSelect
              value={formData.country}
              onValueChange={(value) =>
                setFormData({ ...formData, country: value })
              }
              options={countryOptions}
              placeholder="Select country"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Additional notes"
              rows={3}
            />
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Spinner className="mr-2 h-4 w-4" />}
              {purchaser ? "Update Purchaser" : "Create Purchaser"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard/purchasers")}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
