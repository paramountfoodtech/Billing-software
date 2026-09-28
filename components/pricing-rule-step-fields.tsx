"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Info } from "lucide-react";
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
              "Configure discounts (subtract) or additions (add) based on base price thresholds"}
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

      {values.price_rule_type === "conditional_discount" && (() => {
        const belowVal = values.conditional_discount_below ?? "";
        const isBelowAddition = belowVal.trim().startsWith("-");
        const belowMagnitude = isBelowAddition
          ? belowVal.trim().replace(/^-/, "")
          : belowVal.trim();

        const aboveVal = values.conditional_discount_above_equal ?? "";
        const isAboveAddition = aboveVal.trim().startsWith("-");
        const aboveMagnitude = isAboveAddition
          ? aboveVal.trim().replace(/^-/, "")
          : aboveVal.trim();

        const handleBelowModeChange = (mode: "discount" | "addition") => {
          if (mode === "addition") {
            onChange({
              conditional_discount_below: belowMagnitude ? `-${belowMagnitude}` : "-",
            });
          } else {
            onChange({
              conditional_discount_below: belowMagnitude,
            });
          }
        };

        const handleBelowMagnitudeChange = (val: string) => {
          if (val.trim().startsWith("-")) {
            onChange({ conditional_discount_below: val.trim() });
            return;
          }
          const clean = val.replace(/[^0-9.]/g, "");
          onChange({
            conditional_discount_below: isBelowAddition ? `-${clean}` : clean,
          });
        };

        const handleAboveModeChange = (mode: "discount" | "addition") => {
          if (mode === "addition") {
            onChange({
              conditional_discount_above_equal: aboveMagnitude ? `-${aboveMagnitude}` : "-",
            });
          } else {
            onChange({
              conditional_discount_above_equal: aboveMagnitude,
            });
          }
        };

        const handleAboveMagnitudeChange = (val: string) => {
          if (val.trim().startsWith("-")) {
            onChange({ conditional_discount_above_equal: val.trim() });
            return;
          }
          const clean = val.replace(/[^0-9.]/g, "");
          onChange({
            conditional_discount_above_equal: isAboveAddition ? `-${clean}` : clean,
          });
        };

        return (
          <div className="space-y-4 border rounded-lg p-4 bg-amber-50/60 border-amber-200">
            <div className="flex items-start gap-2.5">
              <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-950 space-y-1">
                <p className="font-semibold text-slate-900">
                  Conditional Pricing (Discount or Addition)
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Adjust product unit prices automatically based on whether the base price is &le; or &gt; a threshold.
                  Select <strong>Discount (-₹)</strong> to subtract from the price, or <strong>Addition (+₹)</strong> to add to the price.
                  (Entering a negative amount also automatically sets it as an Addition).
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-800">
                Threshold Base Price (₹) {required && <span className="text-red-500">*</span>}
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                required={required}
                value={values.conditional_threshold || ""}
                onChange={(e) => onChange({ conditional_threshold: e.target.value })}
                placeholder="e.g., 500.00"
                className="bg-white"
              />
              <p className="text-[11px] text-muted-foreground">
                Base price breakpoint (e.g. ₹500.00)
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Branch 1: <= Threshold */}
              <div className="space-y-2.5 rounded-md border bg-white p-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-800">
                    When Base Price &le; ₹{values.conditional_threshold || "Threshold"}
                  </Label>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                      isBelowAddition
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : "bg-orange-100 text-orange-800 border border-orange-300"
                    }`}
                  >
                    {isBelowAddition ? "+ Addition" : "- Discount"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Action</Label>
                    <Select
                      value={isBelowAddition ? "addition" : "discount"}
                      onValueChange={handleBelowModeChange}
                    >
                      <SelectTrigger className="h-8 text-xs bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="discount">Discount (-₹)</SelectItem>
                        <SelectItem value="addition">Addition (+₹)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">
                      Amount (₹) {required && <span className="text-red-500">*</span>}
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      required={required}
                      value={belowMagnitude}
                      onChange={(e) => handleBelowMagnitudeChange(e.target.value)}
                      placeholder="e.g., 10.00"
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                </div>

                <p className="text-[11px] font-medium text-slate-600 font-mono">
                  Result: Base Price{" "}
                  {isBelowAddition
                    ? `+ ₹${belowMagnitude || "0.00"}`
                    : `- ₹${belowMagnitude || "0.00"}`}
                </p>
              </div>

              {/* Branch 2: > Threshold */}
              <div className="space-y-2.5 rounded-md border bg-white p-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-800">
                    When Base Price &gt; ₹{values.conditional_threshold || "Threshold"}
                  </Label>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                      isAboveAddition
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : "bg-orange-100 text-orange-800 border border-orange-300"
                    }`}
                  >
                    {isAboveAddition ? "+ Addition" : "- Discount"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Action</Label>
                    <Select
                      value={isAboveAddition ? "addition" : "discount"}
                      onValueChange={handleAboveModeChange}
                    >
                      <SelectTrigger className="h-8 text-xs bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="discount">Discount (-₹)</SelectItem>
                        <SelectItem value="addition">Addition (+₹)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">
                      Amount (₹) {required && <span className="text-red-500">*</span>}
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      required={required}
                      value={aboveMagnitude}
                      onChange={(e) => handleAboveMagnitudeChange(e.target.value)}
                      placeholder="e.g., 20.00"
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                </div>

                <p className="text-[11px] font-medium text-slate-600 font-mono">
                  Result: Base Price{" "}
                  {isAboveAddition
                    ? `+ ₹${aboveMagnitude || "0.00"}`
                    : `- ₹${aboveMagnitude || "0.00"}`}
                </p>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
