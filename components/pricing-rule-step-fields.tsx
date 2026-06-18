"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { PRICING_RULE_TYPE_OPTIONS } from "@/lib/pricing-rules";

export interface PricingRuleStepFormValues {
  price_rule_type: string;
  price_rule_value: string;
  conditional_threshold?: string;
  conditional_discount_below?: string;
  conditional_discount_above_equal?: string;
}

interface PricingRuleStepFieldsProps {
  title: string;
  description?: string;
  values: PricingRuleStepFormValues;
  onChange: (updates: Partial<PricingRuleStepFormValues>) => void;
  required?: boolean;
}

export function PricingRuleStepFields({
  title,
  description,
  values,
  onChange,
  required = true,
}: PricingRuleStepFieldsProps) {
  return (
    <div className="space-y-4 rounded-lg border bg-slate-50/60 p-4">
      <div>
        <p className="text-sm font-medium">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>
            Apply Rule {required && <span className="text-red-500">*</span>}
          </Label>
          <SearchableSelect
            value={values.price_rule_type}
            onValueChange={(value) =>
              onChange({
                price_rule_type: value,
                price_rule_value: "",
              })
            }
            options={[...PRICING_RULE_TYPE_OPTIONS]}
            placeholder="Select pricing rule"
            searchPlaceholder="Type pricing rule..."
          />
          <p className="text-xs text-muted-foreground">
            {values.price_rule_type === "discount_percentage" &&
              "Enter percentage off (e.g., 10 for 10% off)"}
            {values.price_rule_type === "discount_flat" &&
              "Enter flat amount off (e.g., 5 for ₹5 off)"}
            {values.price_rule_type === "multiplier" &&
              "Enter multiplier (e.g., 1.25 for 25% markup)"}
            {values.price_rule_type === "flat_addition" &&
              "Enter flat amount to add (e.g., 10 for ₹10 addition)"}
            {values.price_rule_type === "conditional_discount" &&
              "Configure discount amounts based on amount thresholds"}
          </p>
        </div>

        {values.price_rule_type !== "conditional_discount" && (
          <div className="space-y-2">
            <Label>
              Rule Value {required && <span className="text-red-500">*</span>}
            </Label>
            <Input
              type="number"
              step="0.0001"
              min="0"
              required={required}
              value={values.price_rule_value}
              onChange={(e) => onChange({ price_rule_value: e.target.value })}
              placeholder={
                values.price_rule_type === "discount_percentage"
                  ? "10"
                  : values.price_rule_type === "discount_flat"
                    ? "5.00"
                    : values.price_rule_type === "flat_addition"
                      ? "10.00"
                      : "1.25"
              }
            />
          </div>
        )}
      </div>

      {values.price_rule_type === "conditional_discount" && (
        <div className="space-y-4 border rounded-lg p-4 bg-orange-50">
          <div className="space-y-2">
            <Label>
              Threshold Amount (₹){" "}
              {required && <span className="text-red-500">*</span>}
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              required={required}
              value={values.conditional_threshold || ""}
              onChange={(e) =>
                onChange({ conditional_threshold: e.target.value })
              }
              placeholder="e.g., 1000"
              className="bg-white"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>
                Discount when amount &lt; threshold (₹){" "}
                {required && <span className="text-red-500">*</span>}
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                required={required}
                value={values.conditional_discount_below || ""}
                onChange={(e) =>
                  onChange({ conditional_discount_below: e.target.value })
                }
                placeholder="e.g., 500"
                className="bg-white"
              />
            </div>

            <div className="space-y-2">
              <Label>
                Discount when amount ≥ threshold (₹){" "}
                {required && <span className="text-red-500">*</span>}
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                required={required}
                value={values.conditional_discount_above_equal || ""}
                onChange={(e) =>
                  onChange({
                    conditional_discount_above_equal: e.target.value,
                  })
                }
                placeholder="e.g., 750"
                className="bg-white"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
