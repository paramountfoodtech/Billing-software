"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { getIndianToday } from "@/lib/date-time";
import { getPriceForCategoryOnDate } from "@/lib/utils";
import {
  getProfileDisplayName,
  logEntryHistory,
} from "@/lib/entry-history";
import {
  buildClientPricingHistoryRow,
  logClientPricingHistory,
} from "@/lib/client-pricing-history";
import {
  buildPricingRuleDbPayload,
  mapDbRuleToFormState,
  previewChainedPrice,
  type ProductPricingRuleFormState,
} from "@/lib/client-pricing-rule-form";
import {
  applyPricingRuleStep,
  createDefaultPricingRuleStep,
  getPricingRuleStepDescription,
  pricingStepFormToData,
  validatePricingRuleStep,
} from "@/lib/pricing-rules";
import { PricingRuleStepFields } from "@/components/pricing-rule-step-fields";
import { Minus, Plus } from "lucide-react";

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
  price_rule_type_2?: string | null;
  price_rule_value_2?: number | null;
  conditional_threshold_2?: number | null;
  conditional_discount_below_2?: number | null;
  conditional_discount_above_equal_2?: number | null;
  pricing_rule_steps?: Array<{
    price_rule_type: string;
    price_rule_value?: number | null;
    conditional_threshold?: number | null;
    conditional_discount_below?: number | null;
    conditional_discount_above_equal?: number | null;
  }> | null;
}

type ProductPricingRule = ProductPricingRuleFormState;

type NormalizedPricingRuleForCompare = {
  enabled: boolean;
  use_fixed_value: boolean;
  fixed_value: string;
  price_category_id: string;
  notes: string;
  rule_steps: string;
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
  const today = getIndianToday();

  const [selectedClient, setSelectedClient] = useState(
    existingRule?.client_id || existingRules?.[0]?.client_id || "",
  );
  const [productRules, setProductRules] = useState<
    Record<string, ProductPricingRule>
  >(() => {
    if (existingRule) {
      return {
        [existingRule.product_id]: mapDbRuleToFormState(existingRule),
      };
    }
    if (existingRules && existingRules.length > 0) {
      const byProduct: Record<string, ProductPricingRule> = {};
      for (const rule of existingRules) {
        byProduct[rule.product_id] = mapDbRuleToFormState(rule);
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
  const clientOptions = clients.map((client) => ({
    value: client.id,
    label: client.name,
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

  const normalizeRuleStepsForCompare = (
    steps: ProductPricingRule["rule_steps"],
  ) =>
    JSON.stringify(
      steps.map((step) => ({
        price_rule_type: step.price_rule_type || "",
        price_rule_value: normalizeNumericString(step.price_rule_value || ""),
        conditional_threshold: normalizeNumericString(
          step.conditional_threshold || "",
        ),
        conditional_discount_below: normalizeNumericString(
          step.conditional_discount_below || "",
        ),
        conditional_discount_above_equal: normalizeNumericString(
          step.conditional_discount_above_equal || "",
        ),
      })),
    );

  const normalizeCurrentRuleForCompare = (
    rule: ProductPricingRule,
  ): NormalizedPricingRuleForCompare => ({
    enabled: !!rule.enabled,
    use_fixed_value: !!rule.use_fixed_value,
    fixed_value: normalizeNumericString(rule.fixed_value || ""),
    price_category_id: rule.price_category_id || "",
    notes: rule.notes || "",
    rule_steps: normalizeRuleStepsForCompare(rule.rule_steps),
  });

  const initialRulesByProduct = useMemo(() => {
    const map: Record<string, NormalizedPricingRuleForCompare> = {};

    const addFromExistingRule = (r: PricingRule) => {
      map[r.product_id] = normalizeCurrentRuleForCompare(
        mapDbRuleToFormState(r),
      );
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
      // In create-mode / new products: do not show as "edited" since we're creating, not editing.
      return false;
    }

    const current = normalizeCurrentRuleForCompare(rule);
    return (
      initial.enabled !== current.enabled ||
      initial.use_fixed_value !== current.use_fixed_value ||
      initial.fixed_value !== current.fixed_value ||
      initial.price_category_id !== current.price_category_id ||
      initial.notes !== current.notes ||
      initial.rule_steps !== current.rule_steps
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
      for (let i = 0; i < rule.rule_steps.length; i++) {
        const stepError = validatePricingRuleStep(
          pricingStepFormToData(rule.rule_steps[i]),
          `Rule ${i + 1}`,
        );
        if (stepError) {
          setError(stepError);
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
      const userName = await getProfileDisplayName(supabase, user.id);

      const recordPricingHistory = async (
        pricingId: string,
        clientId: string,
        productId: string,
        ruleData: ReturnType<typeof buildPricingRuleDbPayload>,
      ) => {
        await logClientPricingHistory(
          supabase,
          buildClientPricingHistoryRow(
            profile.organization_id,
            pricingId,
            clientId,
            productId,
            ruleData,
            user.id,
          ),
        );
      };

      if (existingRule?.id) {
        const rule = productRules[existingRule.product_id];
        const updateData = buildPricingRuleDbPayload(rule);

        const { error } = await supabase
          .from("client_product_pricing")
          .update(updateData)
          .eq("id", existingRule.id);

        if (error) throw error;
        await logEntryHistory(supabase, {
          organizationId: profile.organization_id,
          entityType: "client_pricing",
          entityId: existingRule.id,
          action: "updated",
          userId: user.id,
          userName,
        });
        await recordPricingHistory(
          existingRule.id,
          existingRule.client_id,
          existingRule.product_id,
          updateData,
        );
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
          const updateData = buildPricingRuleDbPayload(rule);

          const { error } = await supabase
            .from("client_product_pricing")
            .update(updateData)
            .eq("id", rule.id);

          if (error) throw error;
        });

        if (updatePromises.length > 0) {
          await Promise.all(updatePromises);
          for (const rule of rulesToUpdate) {
            if (rule.id) {
              await logEntryHistory(supabase, {
                organizationId: profile.organization_id,
                entityType: "client_pricing",
                entityId: rule.id,
                action: "updated",
                userId: user.id,
                userName,
              });

              const historyData = buildPricingRuleDbPayload(rule);

              await recordPricingHistory(
                rule.id,
                selectedClient,
                rule.product_id,
                historyData,
              );
            }
          }
        }

        if (rulesToCreate.length > 0) {
          const rulesToInsert = rulesToCreate.map((rule) => ({
            client_id: selectedClient,
            product_id: rule.product_id,
            organization_id: profile.organization_id,
            created_by: user.id,
            ...buildPricingRuleDbPayload(rule),
          }));

          const { data: createdRules, error } = await supabase
            .from("client_product_pricing")
            .insert(rulesToInsert)
            .select("id, product_id");

          if (error) {
            if (error.code === "23505") {
              throw new Error(
                "One or more pricing rules already exist for this client. Please check existing rules.",
              );
            }
            throw error;
          }
          for (const row of createdRules ?? []) {
            await logEntryHistory(supabase, {
              organizationId: profile.organization_id,
              entityType: "client_pricing",
              entityId: row.id,
              action: "created",
              userId: user.id,
              userName,
            });

            const insertedRule = rulesToCreate.find(
              (rule) => rule.product_id === row.product_id,
            );
            if (insertedRule) {
              await recordPricingHistory(
                row.id,
                selectedClient,
                row.product_id,
                buildPricingRuleDbPayload(insertedRule),
              );
            }
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
          .map((rule) => ({
            client_id: selectedClient,
            product_id: rule.product_id,
            organization_id: profile.organization_id,
            created_by: user.id,
            ...buildPricingRuleDbPayload(rule),
          }));

        const { data: createdRules, error } = await supabase
          .from("client_product_pricing")
          .insert(rulesToInsert)
          .select("id, product_id");

        if (error) {
          if (error.code === "23505") {
            throw new Error(
              "One or more pricing rules already exist for this client. Please check existing rules.",
            );
          }
          throw error;
        }

        for (const row of createdRules ?? []) {
          await logEntryHistory(supabase, {
            organizationId: profile.organization_id,
            entityType: "client_pricing",
            entityId: row.id,
            action: "created",
            userId: user.id,
            userName,
          });

          const insertedRule = Object.values(productRules).find(
            (rule) => rule.enabled && rule.product_id === row.product_id,
          );
          if (insertedRule) {
            await recordPricingHistory(
              row.id,
              selectedClient,
              row.product_id,
              buildPricingRuleDbPayload(insertedRule),
            );
          }
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
            <SearchableSelect
              id="client_id"
              value={selectedClient}
              onValueChange={setSelectedClient}
              options={clientOptions}
              placeholder="Select a client"
              searchPlaceholder="Type client name..."
              disabled={!!existingRule || (existingRules && existingRules.length > 0)}
            />
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
                notes: "",
                enabled: !!existingRule,
                rule_steps: [createDefaultPricingRuleStep()],
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

                      {rule.rule_steps.map((step, stepIndex) => (
                        <div key={stepIndex} className="space-y-2">
                          <PricingRuleStepFields
                            title={`Rule ${stepIndex + 1}`}
                            description={
                              stepIndex === 0
                                ? "Applied on the base category or fixed price"
                                : `Applied on the price after Rule ${stepIndex}`
                            }
                            values={step}
                            onChange={(updates) => {
                              const nextSteps = [...rule.rule_steps];
                              nextSteps[stepIndex] = {
                                ...nextSteps[stepIndex],
                                ...updates,
                              };
                              updateProductRule({ rule_steps: nextSteps });
                            }}
                          />
                          {stepIndex > 0 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                updateProductRule({
                                  rule_steps: rule.rule_steps.filter(
                                    (_, i) => i !== stepIndex,
                                  ),
                                });
                              }}
                            >
                              <Minus className="h-4 w-4 mr-1" />
                              Remove Rule {stepIndex + 1}
                            </Button>
                          )}
                        </div>
                      ))}

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateProductRule({
                              rule_steps: [
                                ...rule.rule_steps,
                                createDefaultPricingRuleStep(),
                              ],
                            })
                          }
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Rule
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          Each additional rule is applied on the price from the
                          previous rule
                        </p>
                      </div>

                      {(rule.price_category_id || rule.use_fixed_value) &&
                        rule.rule_steps[0]?.price_rule_type &&
                        (rule.rule_steps[0].price_rule_type !==
                        "conditional_discount"
                          ? rule.rule_steps[0].price_rule_value
                          : rule.rule_steps[0].conditional_threshold) &&
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

                          const finalPrice = previewChainedPrice(
                            categoryPrice,
                            rule,
                          );

                          let runningPrice = categoryPrice;
                          const stepDescriptions = rule.rule_steps.map(
                            (formStep, index) => {
                              const stepData = pricingStepFormToData(formStep);
                              const description = getPricingRuleStepDescription(
                                stepData,
                                runningPrice,
                              );
                              runningPrice = applyPricingRuleStep(
                                runningPrice,
                                stepData,
                              );
                              return `Rule ${index + 1}: ${description} (₹${runningPrice.toFixed(2)})`;
                            },
                          );

                          return (
                            <div className="rounded-lg border bg-green-50 p-4 space-y-2">
                              <p className="text-sm font-medium text-green-900">
                                Final Price Preview
                              </p>
                              <p className="text-2xl font-bold text-green-700">
                                ₹{finalPrice.toFixed(2)}
                              </p>
                              <p className="text-xs text-green-600">
                                {categoryName} Base: ₹
                                {categoryPrice.toFixed(2)} →{" "}
                                {stepDescriptions.join(" → ")}
                              </p>
                              {!rule.use_fixed_value && (
                                <p className="text-xs text-blue-600">
                                  On invoices, the category price from the
                                  invoice date will be used as the base
                                </p>
                              )}
                            </div>
                          );
                        })()}

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
