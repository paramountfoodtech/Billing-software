"use client";

import type React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Spinner } from "@/components/ui/spinner";
import { FormBusyOverlay } from "@/components/form-busy-overlay";
import { useToast } from "@/hooks/use-toast";
import {
  getProfileDisplayName,
  logEntryHistory,
} from "@/lib/entry-history";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { sendClientInvitation } from "@/app/actions/send-client-invitation";
import {
  getInvoiceNumberPatternConfigError,
  sanitizeInvoiceNumberInput,
} from "@/lib/invoice-number";
import {
  createPurchaserFromClientContact,
  linkClientAndPurchaser,
  unlinkClientPurchaser,
  type LinkableOption,
} from "@/lib/client-purchaser-link";
import Link from "next/link";

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
  notes: string | null;
  due_days?: number | null;
  due_days_type?: string | null;
  enable_per_bird?: boolean | null;
  value_per_bird?: number | null;
  invoice_number_pattern_type?: string | null;
  invoice_number_pattern?: string | null;
  linked_purchaser_id?: string | null;
}

interface ClientFormProps {
  client?: Client;
  linkedPurchaserName?: string | null;
  unlinkedPurchasers?: LinkableOption[];
}

export function ClientForm({
  client,
  linkedPurchaserName = null,
  unlinkedPurchasers: initialUnlinkedPurchasers = [],
}: ClientFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [fetchingPincode, setFetchingPincode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDualRole, setIsDualRole] = useState(Boolean(client?.linked_purchaser_id));
  const [linkMode, setLinkMode] = useState<"create" | "existing">("create");
  const [selectedPurchaserId, setSelectedPurchaserId] = useState("");
  const [unlinkedPurchasers, setUnlinkedPurchasers] = useState(
    initialUnlinkedPurchasers,
  );

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
    due_days_type: client?.due_days_type || "fixed_days",
    enable_per_bird: client?.enable_per_bird || false,
    value_per_bird: client?.value_per_bird?.toString() || "0",
    invoice_number_pattern_type:
      client?.invoice_number_pattern_type || "general",
    invoice_number_pattern: client?.invoice_number_pattern || "",
  });

  useEffect(() => {
    setUnlinkedPurchasers(initialUnlinkedPurchasers);
  }, [initialUnlinkedPurchasers]);

  useEffect(() => {
    setIsDualRole(Boolean(client?.linked_purchaser_id));
  }, [client?.linked_purchaser_id]);

  const handlePincodeChange = async (pincode: string) => {
    const digitsOnly = pincode.replace(/\D/g, "").slice(0, 6);
    setFormData({ ...formData, zip_code: digitsOnly });

    // Only fetch if pincode is 6 digits (Indian pincode format)
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
      } catch (err) {
        // Silently fail pincode lookup
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
  const dueTypeOptions = [
    { value: "fixed_days", label: "Fixed Number of Days" },
    { value: "end_of_month", label: "End of the billed month" },
  ];
  const invoicePatternTypeOptions = [
    { value: "general", label: "General" },
    { value: "client_specific", label: "Client Specific" },
  ];
  const countryOptions = countries.map((country) => ({
    value: country,
    label: country,
  }));

  const handlePhoneChange = (value: string) => {
    const digitsOnly = value.replace(/\D/g, "").slice(0, 10);
    setFormData((prev) => ({ ...prev, phone: digitsOnly }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const supabase = createClient();

    // Get current user
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
      // Get user's organization
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id, role")
        .eq("id", user.id)
        .single();

      if (!profile?.organization_id) {
        throw new Error("User must belong to an organization");
      }

      // Validate phone is provided and has correct length
      if (!formData.phone || formData.phone.trim().length === 0) {
        toast({
          variant: "destructive",
          title: "Missing phone number",
          description: "Please enter a valid phone number.",
        });
        setIsLoading(false);
        return;
      }

      if (formData.phone.length < 10) {
        toast({
          variant: "destructive",
          title: "Invalid phone number",
          description: "Phone number must be at least 10 digits.",
        });
        setIsLoading(false);
        return;
      }

      const dueDays = Number(formData.due_days) || 0;
      const valuePerBirdRaw = formData.enable_per_bird
        ? formData.value_per_bird.trim()
        : "0";
      const valuePerBird = valuePerBirdRaw === "" ? 0 : Number(valuePerBirdRaw);

      if (Number.isNaN(valuePerBird)) {
        toast({
          variant: "destructive",
          title: "Invalid per-bird value",
          description: "Please enter a valid number (can be negative).",
        });
        setIsLoading(false);
        return;
      }

      const isClientSpecificPattern =
        formData.invoice_number_pattern_type === "client_specific";
      const invoiceNumberPattern = isClientSpecificPattern
        ? sanitizeInvoiceNumberInput(formData.invoice_number_pattern)
        : null;

      if (isClientSpecificPattern) {
        const patternError =
          getInvoiceNumberPatternConfigError(invoiceNumberPattern || "");
        if (patternError) {
          toast({
            variant: "destructive",
            title: "Invalid invoice number pattern",
            description: patternError,
          });
          setIsLoading(false);
          return;
        }
      }

      const clientPayload = {
        ...formData,
        due_days: dueDays,
        value_per_bird: valuePerBird,
        invoice_number_pattern_type: formData.invoice_number_pattern_type,
        invoice_number_pattern: invoiceNumberPattern,
      };

      if (client) {
        // Update existing client
        const { error } = await supabase
          .from("clients")
          .update(clientPayload)
          .eq("id", client.id);

        if (error) throw error;

        const currentlyLinked = Boolean(client.linked_purchaser_id);

        if (isDualRole && !currentlyLinked) {
          let purchaserId = selectedPurchaserId;
          if (linkMode === "create") {
            purchaserId = await createPurchaserFromClientContact(
              supabase,
              profile.organization_id,
              user.id,
              formData,
              profile.role,
            );
          } else if (!purchaserId) {
            throw new Error("Please select a purchaser to link.");
          }
          await linkClientAndPurchaser(
            supabase,
            client.id,
            purchaserId,
            profile.organization_id,
            profile.role,
          );
        } else if (!isDualRole && currentlyLinked) {
          await unlinkClientPurchaser(supabase, {
            clientId: client.id,
            purchaserId: client.linked_purchaser_id,
            organizationId: profile.organization_id,
          });
        }

        const userName = await getProfileDisplayName(supabase, user.id);
        await logEntryHistory(supabase, {
          organizationId: profile.organization_id,
          entityType: "client",
          entityId: client.id,
          action: "updated",
          userId: user.id,
          userName,
        });

        toast({
          variant: "success",
          title: "Client updated",
          description: "Client information has been updated successfully.",
        });
      } else {
        // Create new client
        const { data: created, error } = await supabase
          .from("clients")
          .insert({
            ...clientPayload,
            created_by: user.id,
            organization_id: profile.organization_id,
          })
          .select("id")
          .single();

        if (error) throw error;

        if (created?.id && isDualRole) {
          let purchaserId = selectedPurchaserId;
          if (linkMode === "create") {
            purchaserId = await createPurchaserFromClientContact(
              supabase,
              profile.organization_id,
              user.id,
              formData,
              profile.role,
            );
          } else if (!purchaserId) {
            throw new Error("Please select a purchaser to link.");
          }
          await linkClientAndPurchaser(
            supabase,
            created.id,
            purchaserId,
            profile.organization_id,
            profile.role,
          );
        }

        const userName = await getProfileDisplayName(supabase, user.id);
        if (created?.id) {
          await logEntryHistory(supabase, {
            organizationId: profile.organization_id,
            entityType: "client",
            entityId: created.id,
            action: "created",
            userId: user.id,
            userName,
          });
        }

        // Send invitation email to new client (non-critical)
        await sendClientInvitation(formData.email, formData.name);

        toast({
          variant: "success",
          title: "Client created",
          description: isDualRole
            ? `${formData.name} has been added as client and purchaser.`
            : `${formData.name} has been added successfully.`,
        });
      }

      await router.push("/dashboard/clients");
      router.refresh();
    } catch (error: unknown) {
      let errorMessage = "An unexpected error occurred. Please try again.";

      if (error instanceof Error) {
        if (
          error.message.includes("duplicate") ||
          error.message.includes("unique")
        ) {
          errorMessage =
            "A client with this email already exists in your organization.";
        } else if (error.message.includes("organization")) {
          errorMessage = "Organization error: Please contact support.";
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
    <Card className="relative overflow-hidden">
      <FormBusyOverlay
        active={isLoading}
        label={client ? "Updating client…" : "Creating client…"}
      />
      <CardContent className="pt-6">
        <form
          onSubmit={handleSubmit}
          className={`space-y-6 ${isLoading ? "pointer-events-none select-none" : ""}`}
          aria-busy={isLoading}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">
                Client Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
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
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="contact@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">
                Phone <span className="text-red-500">*</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={10}
                value={formData.phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="00000 00000"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_days_type">Due Payment Type</Label>
              <SearchableSelect
                id="due_days_type"
                value={formData.due_days_type}
                onValueChange={(value) =>
                  setFormData({ ...formData, due_days_type: value })
                }
                options={dueTypeOptions}
                placeholder="Select due days type"
                searchPlaceholder="Type payment type..."
              />
              <p className="text-xs text-muted-foreground">
                {formData.due_days_type === "fixed_days"
                  ? "Invoice due date will be issue date + specified days"
                  : "Invoice due date will always be the last day of the month"}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_days">
                {formData.due_days_type === "fixed_days"
                  ? "Due days to pay"
                  : "Days before end of the billed month"}
              </Label>
              <Input
                id="due_days"
                type="number"
                min="0"
                step="1"
                value={formData.due_days}
                onChange={(e) =>
                  setFormData({ ...formData, due_days: e.target.value })
                }
                placeholder={
                  formData.due_days_type === "fixed_days" ? "30" : "0"
                }
                disabled={formData.due_days_type === "end_of_month"}
              />
              {formData.due_days_type === "end_of_month" && (
                <p className="text-xs text-muted-foreground">
                  Automatically set to the last day of the month. Enter 0 for
                  same month-end, 1 for next month-end, etc.
                </p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <div className="rounded-lg border p-4 bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Per‑bird</span>
                  <Switch
                    id="enable_per_bird"
                    checked={formData.enable_per_bird}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, enable_per_bird: checked })
                    }
                  />
                </div>

                {formData.enable_per_bird && (
                  <div className="mt-2 space-y-2">
                    <Label htmlFor="value_per_bird">Value per bird (₹)</Label>
                    <Input
                      id="value_per_bird"
                      type="number"
                      step="0.01"
                      value={formData.value_per_bird}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          value_per_bird: e.target.value,
                        })
                      }
                      placeholder="e.g., 1.50 or -0.75"
                    />
                    <p className="text-xs text-muted-foreground">
                      Positive adds charge per bird; negative applies discount.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice_number_pattern_type">
                Invoice Number Pattern
              </Label>
              <SearchableSelect
                id="invoice_number_pattern_type"
                value={formData.invoice_number_pattern_type}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    invoice_number_pattern_type: value,
                    invoice_number_pattern:
                      value === "client_specific"
                        ? formData.invoice_number_pattern
                        : "",
                  })
                }
                options={invoicePatternTypeOptions}
                placeholder="Select pattern type"
                searchPlaceholder="Type pattern type..."
              />
              <p className="text-xs text-muted-foreground">
                {formData.invoice_number_pattern_type === "client_specific"
                  ? "Invoices for this client will use the custom pattern below."
                  : "Uses the organization-wide invoice numbering sequence."}
              </p>
            </div>

            {formData.invoice_number_pattern_type === "client_specific" && (
              <div className="space-y-2">
                <Label htmlFor="invoice_number_pattern">
                  Custom Pattern <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="invoice_number_pattern"
                  required
                  value={formData.invoice_number_pattern}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      invoice_number_pattern: sanitizeInvoiceNumberInput(
                        e.target.value,
                      ),
                    })
                  }
                  placeholder="e.g., A or A1"
                  maxLength={6}
                />
                <p className="text-xs text-muted-foreground">
                  Enter a letter prefix (e.g. A → A1, A2…) or a starting number
                  (e.g. A100, 0001).
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <SearchableSelect
                id="country"
                value={formData.country}
                onValueChange={(value) =>
                  setFormData({ ...formData, country: value })
                }
                options={countryOptions}
                placeholder="Select country"
                searchPlaceholder="Type country..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
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
                  placeholder="6-digit pincode"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  disabled={fetchingPincode}
                />
                {fetchingPincode && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Spinner className="h-4 w-4" />
                  </div>
                )}
              </div>
              {fetchingPincode && (
                <p className="text-xs text-blue-600 flex items-center gap-1">
                  <Spinner className="h-3 w-3" />
                  Fetching location...
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) =>
                  setFormData({ ...formData, city: e.target.value })
                }
                placeholder="Mumbai"
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
                placeholder="Maharashtra"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Additional information about this client..."
              rows={4}
            />
          </div>

          <div className="rounded-lg border p-4 bg-white space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="is_dual_role">Also a purchaser</Label>
                <p className="text-xs text-muted-foreground">
                  Same party sells to you and buys from you. Creates or links a
                  purchaser record.
                </p>
              </div>
              <Switch
                id="is_dual_role"
                checked={isDualRole}
                onCheckedChange={(checked) => {
                  setIsDualRole(checked);
                  if (!checked) {
                    setSelectedPurchaserId("");
                    setLinkMode("create");
                  }
                }}
              />
            </div>

            {isDualRole && client?.linked_purchaser_id && (
              <div className="text-sm space-y-2">
                <p>
                  Linked purchaser:{" "}
                  <span className="font-medium">
                    {linkedPurchaserName || "Purchaser"}
                  </span>
                </p>
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={`/dashboard/trade-summary?clientId=${client.id}`}
                  >
                    View buy &amp; sell summary
                  </Link>
                </Button>
                <p className="text-xs text-muted-foreground">
                  Turn off the toggle and save to unlink (records are kept).
                </p>
              </div>
            )}

            {isDualRole && !client?.linked_purchaser_id && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={linkMode === "create" ? "default" : "outline"}
                    onClick={() => setLinkMode("create")}
                  >
                    Create new purchaser
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={linkMode === "existing" ? "default" : "outline"}
                    onClick={() => setLinkMode("existing")}
                  >
                    Link existing purchaser
                  </Button>
                </div>
                {linkMode === "create" ? (
                  <p className="text-xs text-muted-foreground">
                    A purchaser will be created with the same name, phone,
                    email, and address.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <Label>Select purchaser</Label>
                    <SearchableSelect
                      value={selectedPurchaserId}
                      onValueChange={setSelectedPurchaserId}
                      options={unlinkedPurchasers.map((p) => ({
                        value: p.id,
                        label: p.label,
                      }))}
                      placeholder="Choose purchaser..."
                      searchPlaceholder="Search purchasers..."
                    />
                    {unlinkedPurchasers.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        No unlinked purchasers available.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-4 pt-4">
            <Button
              type="submit"
              disabled={isLoading || fetchingPincode}
              className="min-w-32"
            >
              {isLoading ? (
                <>
                  <Spinner className="mr-2" />
                  {client ? "Updating..." : "Creating..."}
                </>
              ) : (
                <>{client ? "Update Client" : "Create Client"}</>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isLoading}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
