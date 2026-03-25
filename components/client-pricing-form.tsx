"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { getPriceForCategoryOnDate } from "@/lib/utils";

interface Client {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  description?: string;
  paper_price: string;
}

interface PriceCategory {
  id: string;
  name: string;
  currentPrice?: number | null;
}

interface PricingRule {
  id?: string;
  client_id: string;
  product_id: string;
  price_rule_type: string;
  price_rule_value: string | null;
  price_category_id?: string | null;
  fixed_base_value?: number | null;
  notes: string;
  conditional_threshold?: number | null;
  conditional_discount_below?: number | null;
  conditional_discount_above_equal?: number | null;
}

interface ProductPricingRule {
  product_id: string;
  price_category_id: string;
  price_rule_type: string;
  price_rule_value: string;
  notes: string;
  enabled: boolean;
  // Present in bulk edit mode so we can update the existing DB row.
  id?: string;
  fixed_value?: string;
  use_fixed_value?: boolean;
  conditional_threshold?: string;
  conditional_discount_below?: string;
  conditional_discount_above_equal?: string;
}

type NormalizedPricingRuleForCompare = {
  enabled: boolean;
  use_fixed_value: boolean;
  fixed_value: string;
  price_category_id: string;
  price_rule_type: string;
  price_rule_value: string;
  notes: string;
  conditional_threshold: string;
  conditional_discount_below: string;
  conditional_discount_above_equal: string;
};

interface ClientPricingFormProps {
  clients: Client[];
  products: Product[];
  existingRule?: PricingRule;
  existingRules?: PricingRule[];
  priceCategories?: PriceCategory[];
  priceHistory?: Array<{
    price_category_id: string;
    price: number;
    effective_date: string;
  }>;
}

export function ClientPricingForm({
  clients,
  products,
  existingRule,
  existingRules,
  priceCategories = [],
  priceHistory = [],
}: ClientPricingFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<PriceCategory[]>([]);
  const [history, setHistory] = useState<
    Array<{
      price_category_id: string;
      price: number;
      effective_date: string;
    }>
  >(priceHistory);
  const today = new Date().toISOString().split("T")[0];

  const [selectedClient, setSelectedClient] = useState(
    existingRule?.client_id || existingRules?.[0]?.client_id || "",
  );
  const [productRules, setProductRules] = useState<
    Record<string, ProductPricingRule>
  >(() => {
    if (existingRule) {
      const useFixedValue = !!existingRule.fixed_base_value;
      return {
        [existingRule.product_id]: {
          product_id: existingRule.product_id,
          price_category_id: existingRule.price_category_id || "",
          price_rule_type: existingRule.price_rule_type,
          price_rule_value: existingRule.price_rule_value?.toString() || "",
          notes: existingRule.notes || "",
          enabled: true,
          fixed_value: existingRule.fixed_base_value?.toString() || "",
          use_fixed_value: useFixedValue,
          conditional_threshold:
            existingRule.conditional_threshold?.toString() || "",
          conditional_discount_below:
            existingRule.conditional_discount_below?.toString() || "",
          conditional_discount_above_equal:
            existingRule.conditional_discount_above_equal?.toString() || "",
        },
      };
    }
    if (existingRules && existingRules.length > 0) {
      const byProduct: Record<string, ProductPricingRule> = {};
      for (const rule of existingRules) {
        const useFixedValue = !!rule.fixed_base_value;
        byProduct[rule.product_id] = {
          id: rule.id,
          product_id: rule.product_id,
          price_category_id: rule.price_category_id || "",
          price_rule_type: rule.price_rule_type,
          price_rule_value: rule.price_rule_value?.toString() || "",
          notes: rule.notes || "",
          enabled: true,
          fixed_value: rule.fixed_base_value?.toString() || "",
          use_fixed_value: useFixedValue,
          conditional_threshold: rule.conditional_threshold?.toString() || "",
          conditional_discount_below:
            rule.conditional_discount_below?.toString() || "",
          conditional_discount_above_equal:
            rule.conditional_discount_above_equal?.toString() || "",
        };
      }
      return byProduct;
    }
    return {};
  });

  // Fetch price categories and history if not provided
  useEffect(() => {
    const load = async () => {
      if (priceCategories.length > 0) {
        setCategories(priceCategories);
      }
      if (priceHistory.length > 0) {
        setHistory(priceHistory);
      }

      if (priceCategories.length === 0 || priceHistory.length === 0) {
        const supabase = createClient();
        const [catResult, historyResult] = await Promise.all([
          supabase.from("price_categories").select("id, name").order("name"),
          supabase
            .from("price_category_history")
            .select("price_category_id, price, effective_date"),
        ]);

        if (catResult.data) setCategories(catResult.data);
        if (historyResult.data) setHistory(historyResult.data);
      }
    };

    load();
  }, [priceCategories, priceHistory]);

  const categoriesWithPrice = categories.map((cat) => ({
    ...cat,
    currentPrice: getPriceForCategoryOnDate(cat.id, today, history),
  }));

  const normalizeNumericString = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    const str = String(value).trim();
    if (!str) return "";
    const n = Number(str);
    if (Number.isNaN(n)) return str;
    // Normalize 150.00 -> "150" so formatting changes don't look like edits.
    return String(n);
  };

  const normalizeCurrentRuleForCompare = (
    rule: ProductPricingRule,
  ): NormalizedPricingRuleForCompare => ({
    enabled: !!rule.enabled,
    use_fixed_value: !!rule.use_fixed_value,
    fixed_value: normalizeNumericString(rule.fixed_value || ""),
    price_category_id: rule.price_category_id || "",
    price_rule_type: rule.price_rule_type || "",
    price_rule_value: normalizeNumericString(rule.price_rule_value || ""),
    notes: rule.notes || "",
    conditional_threshold: normalizeNumericString(
      rule.conditional_threshold || "",
    ),
    conditional_discount_below: normalizeNumericString(
      rule.conditional_discount_below || "",
    ),
    conditional_discount_above_equal: normalizeNumericString(
      rule.conditional_discount_above_equal || "",
    ),
  });

  const initialRulesByProduct = useMemo(() => {
    const map: Record<string, NormalizedPricingRuleForCompare> = {};

    const addFromExistingRule = (r: PricingRule) => {
      map[r.product_id] = {
        enabled: true,
        use_fixed_value:
          r.fixed_base_value !== null && r.fixed_base_value !== undefined,
        fixed_value: normalizeNumericString(r.fixed_base_value ?? ""),
        price_category_id: r.price_category_id || "",
        price_rule_type: r.price_rule_type || "",
        price_rule_value: normalizeNumericString(r.price_rule_value ?? ""),
        notes: r.notes || "",
        conditional_threshold: normalizeNumericString(
          r.conditional_threshold ?? "",
        ),
        conditional_discount_below: normalizeNumericString(
          r.conditional_discount_below ?? "",
        ),
        conditional_discount_above_equal: normalizeNumericString(
          r.conditional_discount_above_equal ?? "",
        ),
      };
    };

    if (existingRule) {
      addFromExistingRule(existingRule);
    } else if (existingRules && existingRules.length > 0) {
      for (const r of existingRules) addFromExistingRule(r);
    }

    return map;
  }, [existingRule, existingRules]);

  const isProductRuleEdited = (productId: string, rule: ProductPricingRule) => {
    const initial = initialRulesByProduct[productId];
    if (!initial) {
      // In create-mode / new products: consider it "edited" once user enables it.
      return !!rule.enabled;
    }

    const current = normalizeCurrentRuleForCompare(rule);
    return (
      initial.enabled !== current.enabled ||
      initial.use_fixed_value !== current.use_fixed_value ||
      initial.fixed_value !== current.fixed_value ||
      initial.price_category_id !== current.price_category_id ||
      initial.price_rule_type !== current.price_rule_type ||
      initial.price_rule_value !== current.price_rule_value ||
      initial.notes !== current.notes ||
      initial.conditional_threshold !== current.conditional_threshold ||
      initial.conditional_discount_below !== current.conditional_discount_below ||
      initial.conditional_discount_above_equal !==
        current.conditional_discount_above_equal
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const enabledRules = Object.values(productRules).filter(
      (rule) => rule.enabled,
    );

    if (enabledRules.length === 0) {
      setError("Please enable and configure at least one product");
      setIsLoading(false);
      return;
    }

    for (const rule of enabledRules) {
      if (!rule.price_category_id && !rule.use_fixed_value) {
        setError(
          "Please select a category or fixed value for all enabled products",
        );
        setIsLoading(false);
        return;
      }
      if (rule.use_fixed_value && !rule.fixed_value) {
        setError(
          "Please enter a fixed value for all enabled products using fixed value",
        );
        setIsLoading(false);
        return;
      }
      if (
        rule.price_rule_type !== "conditional_discount" &&
        !rule.price_rule_value
      ) {
        setError("Please enter a rule value for all enabled products");
        setIsLoading(false);
        return;
      }
      if (rule.price_rule_type === "conditional_discount") {
        if (
          !rule.conditional_threshold ||
          !rule.conditional_discount_below ||
          !rule.conditional_discount_above_equal
        ) {
          setError(
            "Please enter all conditional discount values (threshold, below, and above/equal)",
          );
          setIsLoading(false);
          return;
        }
      }
    }

    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("You must be logged in");
      setIsLoading(false);
      return;
    }

    // Get user's organization
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organization_id) {
      setError("Organization not found");
      setIsLoading(false);
      return;
    }

    try {
      if (existingRule?.id) {
        // Update existing rule (single product mode)
        const rule = productRules[existingRule.product_id];
        const updateData: any = {
          price_rule_type: rule.price_rule_type,
          notes: rule.notes,
        };

        if (rule.price_rule_type === "conditional_discount") {
          updateData.conditional_threshold = Number(rule.conditional_threshold);
          updateData.conditional_discount_below = Number(
            rule.conditional_discount_below,
          );
          updateData.conditional_discount_above_equal = Number(
            rule.conditional_discount_above_equal,
          );
          updateData.price_rule_value = null;
        } else {
          updateData.price_rule_value = Number(rule.price_rule_value);
          updateData.conditional_threshold = null;
          updateData.conditional_discount_below = null;
          updateData.conditional_discount_above_equal = null;
        }

        if (rule.use_fixed_value) {
          updateData.fixed_base_value = Number(rule.fixed_value);
          updateData.price_category_id = null;
        } else {
          updateData.price_category_id = rule.price_category_id;
          updateData.fixed_base_value = null;
        }

        const { error } = await supabase
          .from("client_product_pricing")
          .update(updateData)
          .eq("id", existingRule.id);

        if (error) throw error;
        toast({
          variant: "success",
          title: "Success",
          description: "Pricing rule updated successfully.",
        });
      } else if (existingRules && existingRules.length > 0) {
        // Bulk edit mode: update existing rules for the client, and optionally create any newly enabled products.
        const rulesToUpdate = enabledRules.filter((r) => !!r.id);
        const rulesToCreate = enabledRules.filter((r) => !r.id);

        const updatePromises = rulesToUpdate.map(async (rule) => {
          const updateData: any = {
            price_rule_type: rule.price_rule_type,
            notes: rule.notes,
          };

          if (rule.price_rule_type === "conditional_discount") {
            updateData.conditional_threshold = Number(
              rule.conditional_threshold,
            );
            updateData.conditional_discount_below = Number(
              rule.conditional_discount_below,
            );
            updateData.conditional_discount_above_equal = Number(
              rule.conditional_discount_above_equal,
            );
            updateData.price_rule_value = null;
          } else {
            updateData.price_rule_value = Number(rule.price_rule_value);
            updateData.conditional_threshold = null;
            updateData.conditional_discount_below = null;
            updateData.conditional_discount_above_equal = null;
          }

          if (rule.use_fixed_value) {
            updateData.fixed_base_value = Number(rule.fixed_value);
            updateData.price_category_id = null;
          } else {
            updateData.price_category_id = rule.price_category_id;
            updateData.fixed_base_value = null;
          }

          const { error } = await supabase
            .from("client_product_pricing")
            .update(updateData)
            .eq("id", rule.id);

          if (error) throw error;
        });

        if (updatePromises.length > 0) {
          await Promise.all(updatePromises);
        }

        if (rulesToCreate.length > 0) {
          const rulesToInsert = rulesToCreate.map((rule) => {
            const baseData = {
              client_id: selectedClient,
              product_id: rule.product_id,
              price_rule_type: rule.price_rule_type,
              notes: rule.notes,
              organization_id: profile.organization_id,
              created_by: user.id,
            } as any;

            if (rule.price_rule_type === "conditional_discount") {
              baseData.conditional_threshold = Number(
                rule.conditional_threshold,
              );
              baseData.conditional_discount_below = Number(
                rule.conditional_discount_below,
              );
              baseData.conditional_discount_above_equal = Number(
                rule.conditional_discount_above_equal,
              );
              baseData.price_rule_value = null;
            } else {
              baseData.price_rule_value = Number(rule.price_rule_value);
              baseData.conditional_threshold = null;
              baseData.conditional_discount_below = null;
              baseData.conditional_discount_above_equal = null;
            }

            if (rule.use_fixed_value) {
              baseData.fixed_base_value = Number(rule.fixed_value);
              baseData.price_category_id = null;
            } else {
              baseData.price_category_id = rule.price_category_id;
              baseData.fixed_base_value = null;
            }

            return baseData;
          });

          const { error } = await supabase
            .from("client_product_pricing")
            .insert(rulesToInsert);

          if (error) {
            if (error.code === "23505") {
              throw new Error(
                "One or more pricing rules already exist for this client. Please check existing rules.",
              );
            }
            throw error;
          }
        }

        toast({
          variant: "success",
          title: "Success",
          description: `${enabledRules.length} pricing rule(s) saved successfully.`,
        });
      } else {
        // Bulk create new rules
        const rulesToInsert = Object.values(productRules)
          .filter((rule) => rule.enabled)
          .map((rule) => {
            const baseData = {
              client_id: selectedClient,
              product_id: rule.product_id,
              price_rule_type: rule.price_rule_type,
              notes: rule.notes,
              organization_id: profile.organization_id,
              created_by: user.id,
            } as any;

            if (rule.price_rule_type === "conditional_discount") {
              baseData.conditional_threshold = Number(
                rule.conditional_threshold,
              );
              baseData.conditional_discount_below = Number(
                rule.conditional_discount_below,
              );
              baseData.conditional_discount_above_equal = Number(
                rule.conditional_discount_above_equal,
              );
              baseData.price_rule_value = null;
            } else {
              baseData.price_rule_value = Number(rule.price_rule_value);
              baseData.conditional_threshold = null;
              baseData.conditional_discount_below = null;
              baseData.conditional_discount_above_equal = null;
            }

            if (rule.use_fixed_value) {
              baseData.fixed_base_value = Number(rule.fixed_value);
              baseData.price_category_id = null;
            } else {
              baseData.price_category_id = rule.price_category_id;
              baseData.fixed_base_value = null;
            }

            return baseData;
          });

        const { error } = await supabase
          .from("client_product_pricing")
          .insert(rulesToInsert);

        if (error) {
          if (error.code === "23505") {
            throw new Error(
              "One or more pricing rules already exist for this client. Please check existing rules.",
            );
          }
          throw error;
        }

        toast({
          variant: "success",
          title: "Success",
          description: `${rulesToInsert.length} pricing rule(s) created successfully.`,
        });
      }

      router.push("/dashboard/client-pricing");
      router.refresh();
    } catch (error: unknown) {
      const errorMsg =
        error instanceof Error ? error.message : "An error occurred";
      setError(errorMsg);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMsg,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const enabledCount = Object.values(productRules).filter(
    (r) => r.enabled,
  ).length;

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="client_id">
              Client <span className="text-red-500">*</span>
            </Label>
            <Select
              value={selectedClient}
              onValueChange={setSelectedClient}
              disabled={!!existingRule || (existingRules && existingRules.length > 0)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!existingRule && selectedClient && (
              <p className="text-sm text-muted-foreground mt-2">
                Configure pricing rules for products below. Enable products by
                checking the box.
              </p>
            )}
          </div>

          {!selectedClient && !existingRule && (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <p className="text-muted-foreground">
                Select a client to configure product pricing
              </p>
            </div>
          )}

          {(selectedClient || existingRule) &&
            products.map((product) => {
              const rule = productRules[product.id] || {
                product_id: product.id,
                price_category_id: "",
                price_rule_type: "discount_percentage",
                price_rule_value: "",
                notes: "",
                enabled: !!existingRule,
              };

              if (existingRule && existingRule.product_id !== product.id)
                return null;

              const edited = isProductRuleEdited(product.id, rule);

              const updateProductRule = (
                updates: Partial<ProductPricingRule>,
              ) => {
                setProductRules((prev) => ({
                  ...prev,
                  [product.id]: { ...rule, ...updates },
                }));
              };

              return (
                <div
                  key={product.id}
                  className={`border rounded-lg p-6 space-y-4 ${
                    edited
                      ? "bg-purple-50 border-purple-300 ring-2 ring-purple-200"
                      : ""
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {!existingRule && (
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={(e) =>
                            updateProductRule({ enabled: e.target.checked })
                          }
                          className="h-5 w-5 rounded border-gray-300 mt-1 cursor-pointer"
                        />
                      )}
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold">
                          {product.name}
                        </h3>
                        {product.description && (
                          <p className="text-sm text-muted-foreground">
                            {product.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {edited && (
                      <div className="flex flex-col items-end">
                        <span className="text-xs font-semibold text-purple-700 bg-purple-100 border border-purple-200 px-2 py-1 rounded">
                          Edited
                        </span>
                      </div>
                    )}
                  </div>

                  {(rule.enabled || existingRule) && (
                    <div className="space-y-4 pl-0 md:pl-8">
                      <div className="space-y-2">
                        <Label>
                          Select Base Price Category{" "}
                          <span className="text-red-500">*</span>
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Click on a category to use its daily price as the base
                          for this product
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mt-3">
                          {(() => {
                            const isEggProduct = /egg/i.test(product.name);
                            const filtered = categoriesWithPrice.filter(
                              (category) => {
                                const isEggCategory = /egg/i.test(
                                  category.name,
                                );
                                return isEggProduct
                                  ? isEggCategory
                                  : !isEggCategory;
                              },
                            );
                            return filtered.map((category) => (
                              <button
                                key={category.id}
                                type="button"
                                onClick={() =>
                                  updateProductRule({
                                    price_category_id: category.id,
                                    use_fixed_value: false,
                                  })
                                }
                                className={`rounded-lg border p-3 text-center transition-all hover:shadow-md ${
                                  category.id === rule.price_category_id &&
                                  !rule.use_fixed_value
                                    ? "bg-blue-50 border-blue-400 ring-2 ring-blue-300 shadow-sm"
                                    : "bg-white border-gray-200 hover:border-blue-200"
                                }`}
                              >
                                <p
                                  className={`text-base font-semibold ${
                                    category.id === rule.price_category_id &&
                                    !rule.use_fixed_value
                                      ? "text-blue-900"
                                      : "text-gray-700"
                                  }`}
                                >
                                  {category.name}
                                </p>
                                <p
                                  className={`text-xs mt-1 ${
                                    category.id === rule.price_category_id &&
                                    !rule.use_fixed_value
                                      ? "text-blue-600 font-medium"
                                      : "text-gray-500"
                                  }`}
                                >
                                  {category.id === rule.price_category_id &&
                                  !rule.use_fixed_value
                                    ? "✓ Selected"
                                    : "Click to select"}
                                </p>
                              </button>
                            ));
                          })()}

                          {/* Fixed Value Button */}
                          <button
                            type="button"
                            onClick={() =>
                              updateProductRule({ use_fixed_value: true })
                            }
                            className={`rounded-lg border p-3 text-center transition-all hover:shadow-md ${
                              rule.use_fixed_value
                                ? "bg-purple-50 border-purple-400 ring-2 ring-purple-300 shadow-sm"
                                : "bg-white border-gray-200 hover:border-purple-200"
                            }`}
                          >
                            <p
                              className={`text-base font-semibold ${
                                rule.use_fixed_value
                                  ? "text-purple-900"
                                  : "text-gray-700"
                              }`}
                            >
                              Fixed Value
                            </p>
                            <p
                              className={`text-xs mt-1 ${
                                rule.use_fixed_value
                                  ? "text-purple-600 font-medium"
                                  : "text-gray-500"
                              }`}
                            >
                              {rule.use_fixed_value
                                ? "✓ Selected"
                                : "Click to select"}
                            </p>
                          </button>
                        </div>
                      </div>

                      {/* Fixed Value Input */}
                      {rule.use_fixed_value && (
                        <div className="space-y-2">
                          <Label>
                            Enter Fixed Value{" "}
                            <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            required={rule.use_fixed_value}
                            value={rule.fixed_value || ""}
                            onChange={(e) =>
                              updateProductRule({ fixed_value: e.target.value })
                            }
                            placeholder="Enter the fixed price value (e.g., 150.00)"
                            className="bg-purple-50"
                          />
                          <p className="text-xs text-muted-foreground">
                            This fixed value will be used as the base price
                            instead of a daily category price
                          </p>
                        </div>
                      )}

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>
                            Apply Rule <span className="text-red-500">*</span>
                          </Label>
                          <Select
                            value={rule.price_rule_type}
                            onValueChange={(value) =>
                              updateProductRule({
                                price_rule_type: value,
                                price_rule_value: "",
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select pricing rule" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="discount_percentage">
                                Discount Percentage (%)
                              </SelectItem>
                              <SelectItem value="discount_flat">
                                Discount Flat Amount (₹)
                              </SelectItem>
                              <SelectItem value="multiplier">
                                Multiplier (e.g., 1.25)
                              </SelectItem>
                              <SelectItem value="flat_addition">
                                Flat Amount Addition (₹)
                              </SelectItem>
                              <SelectItem value="conditional_discount">
                                Conditional Discount (₹)
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            {rule.price_rule_type === "discount_percentage" &&
                              "Enter percentage off category price (e.g., 10 for 10% off)"}
                            {rule.price_rule_type === "discount_flat" &&
                              "Enter flat amount off category price (e.g., 5 for ₹5 off)"}
                            {rule.price_rule_type === "multiplier" &&
                              "Enter multiplier on category price (e.g., 1.25 for 25% markup)"}
                            {rule.price_rule_type === "flat_addition" &&
                              "Enter flat amount to add to category price (e.g., 10 for ₹10 addition)"}
                            {rule.price_rule_type === "conditional_discount" &&
                              "Configure discount amounts based on quantity thresholds"}
                          </p>
                        </div>

                        {rule.price_rule_type !== "conditional_discount" && (
                          <div className="space-y-2">
                            <Label>
                              Rule Value <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              type="number"
                              step="0.0001"
                              min="0"
                              required={rule.enabled}
                              value={rule.price_rule_value}
                              onChange={(e) =>
                                updateProductRule({
                                  price_rule_value: e.target.value,
                                })
                              }
                              placeholder={
                                rule.price_rule_type === "discount_percentage"
                                  ? "10"
                                  : rule.price_rule_type === "discount_flat"
                                    ? "5.00"
                                    : rule.price_rule_type === "flat_addition"
                                      ? "10.00"
                                      : "1.25"
                              }
                            />
                          </div>
                        )}
                      </div>

                      {/* Conditional Discount Fields */}
                      {rule.price_rule_type === "conditional_discount" && (
                        <div className="space-y-4 border rounded-lg p-4 bg-orange-50">
                          <div className="space-y-2">
                            <Label>
                              Threshold Amount (₹){" "}
                              <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              required
                              value={rule.conditional_threshold || ""}
                              onChange={(e) =>
                                updateProductRule({
                                  conditional_threshold: e.target.value,
                                })
                              }
                              placeholder="e.g., 1000"
                              className="bg-white"
                            />
                            <p className="text-xs text-muted-foreground">
                              The amount threshold for switching between
                              discount levels
                            </p>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label>
                                Discount when amount &lt; threshold (₹){" "}
                                <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                required
                                value={rule.conditional_discount_below || ""}
                                onChange={(e) =>
                                  updateProductRule({
                                    conditional_discount_below: e.target.value,
                                  })
                                }
                                placeholder="e.g., 500"
                                className="bg-white"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>
                                Discount when amount ≥ threshold (₹){" "}
                                <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                required
                                value={
                                  rule.conditional_discount_above_equal || ""
                                }
                                onChange={(e) =>
                                  updateProductRule({
                                    conditional_discount_above_equal:
                                      e.target.value,
                                  })
                                }
                                placeholder="e.g., 750"
                                className="bg-white"
                              />
                            </div>
                          </div>

                          <p className="text-xs text-orange-700 bg-orange-100 p-2 rounded">
                            Example: If threshold is ₹1000, items ≤ ₹1000 get
                            ₹500 discount, items &gt; ₹1000 get ₹750 discount
                          </p>
                        </div>
                      )}

                      {(rule.price_category_id || rule.use_fixed_value) &&
                        rule.price_rule_value &&
                        rule.price_rule_type &&
                        rule.price_rule_type !== "conditional_discount" &&
                        (() => {
                          let categoryPrice = 0;
                          let categoryName = "Fixed Value";

                          if (rule.use_fixed_value) {
                            categoryPrice = Number(rule.fixed_value || 0);
                            categoryName = "Fixed Value";
                          } else {
                            const selectedCategory = categoriesWithPrice.find(
                              (c) => c.id === rule.price_category_id,
                            );
                            categoryPrice = selectedCategory?.currentPrice || 0;
                            categoryName = selectedCategory?.name || "N/A";
                          }

                          const ruleValue = Number(rule.price_rule_value);
                          let finalPrice = categoryPrice;

                          switch (rule.price_rule_type) {
                            case "discount_percentage":
                              finalPrice =
                                categoryPrice * (1 - ruleValue / 100);
                              break;
                            case "discount_flat":
                              finalPrice = Math.max(
                                0,
                                categoryPrice - ruleValue,
                              );
                              break;
                            case "multiplier":
                              finalPrice = categoryPrice * ruleValue;
                              break;
                            case "flat_addition":
                              finalPrice = categoryPrice + ruleValue;
                              break;
                          }

                          return (
                            <div className="rounded-lg border bg-green-50 p-4">
                              <p className="text-sm font-medium text-green-900 mb-2">
                                Final Price Preview
                              </p>
                              <p className="text-2xl font-bold text-green-700">
                                ₹{finalPrice.toFixed(2)}
                              </p>
                              <p className="text-xs text-green-600 mt-1">
                                {categoryName} Base: ₹{categoryPrice.toFixed(2)}{" "}
                                →{" "}
                                {rule.price_rule_type ===
                                  "discount_percentage" &&
                                  `${rule.price_rule_value}% off`}
                                {rule.price_rule_type === "discount_flat" &&
                                  `₹${rule.price_rule_value} off`}
                                {rule.price_rule_type === "multiplier" &&
                                  `× ${rule.price_rule_value}`}
                                {rule.price_rule_type === "flat_addition" &&
                                  `+ ₹${rule.price_rule_value}`}
                              </p>
                              {!rule.use_fixed_value && (
                                <p className="text-xs text-blue-600 mt-1">
                                  Note: On invoices, the category price from the
                                  invoice date will be used
                                </p>
                              )}
                            </div>
                          );
                        })()}

                      {/* Conditional Discount Preview */}
                      {rule.price_rule_type === "conditional_discount" &&
                        rule.conditional_threshold &&
                        rule.conditional_discount_below &&
                        rule.conditional_discount_above_equal && (
                          <div className="rounded-lg border bg-orange-50 p-4">
                            <p className="text-sm font-medium text-orange-900 mb-3">
                              Conditional Discount Preview
                            </p>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center p-3 bg-white rounded border border-orange-200">
                                <span className="text-sm text-orange-800">
                                  Amount &lt; ₹
                                  {Number(rule.conditional_threshold).toFixed(
                                    2,
                                  )}
                                </span>
                                <span className="text-lg font-bold text-orange-700">
                                  -₹
                                  {Number(
                                    rule.conditional_discount_below,
                                  ).toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between items-center p-3 bg-white rounded border border-orange-200">
                                <span className="text-sm text-orange-800">
                                  Amount ≥ ₹
                                  {Number(rule.conditional_threshold).toFixed(
                                    2,
                                  )}
                                </span>
                                <span className="text-lg font-bold text-orange-700">
                                  -₹
                                  {Number(
                                    rule.conditional_discount_above_equal,
                                  ).toFixed(2)}
                                </span>
                              </div>
                            </div>
                            <p className="text-xs text-orange-600 mt-2">
                              These discounts will be applied to invoice items
                              based on their amount
                            </p>
                          </div>
                        )}

                      <div className="space-y-2">
                        <Label>Notes</Label>
                        <Textarea
                          value={rule.notes}
                          onChange={(e) =>
                            updateProductRule({ notes: e.target.value })
                          }
                          placeholder="Additional notes about this pricing rule..."
                          rows={2}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          <div className="flex gap-4">
            <Button
              type="submit"
              disabled={isLoading || !selectedClient || enabledCount === 0}
            >
              {isLoading && <Spinner className="h-4 w-4 mr-2" />}
              {isLoading
                ? "Saving..."
                : existingRule
                  ? "Update Pricing Rule"
                  : existingRules && existingRules.length > 0
                    ? "Update Pricing Rules"
                    : `Create ${enabledCount} Rule${enabledCount !== 1 ? "s" : ""}`}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
