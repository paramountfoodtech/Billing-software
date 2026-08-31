import type { PricingRuleStepFormValues } from "@/components/pricing-rule-step-fields";

export type PricingRuleStepData = {
  price_rule_type: string;
  price_rule_value?: number | string | null;
  conditional_threshold?: number | string | null;
  conditional_discount_below?: number | string | null;
  conditional_discount_above_equal?: number | string | null;
};

export type DbPricingRuleRow = PricingRuleStepData & {
  price_rule_type_2?: string | null;
  price_rule_value_2?: number | string | null;
  conditional_threshold_2?: number | string | null;
  conditional_discount_below_2?: number | string | null;
  conditional_discount_above_equal_2?: number | string | null;
  pricing_rule_steps?: PricingRuleStepData[] | null;
};

/** @deprecated Use DbPricingRuleRow */
export type ChainedPricingRuleData = DbPricingRuleRow;

export const PRICING_RULE_TYPE_OPTIONS = [
  { value: "discount_percentage", label: "Discount Percentage (%)" },
  { value: "discount_flat", label: "Discount Flat Amount (₹)" },
  { value: "multiplier", label: "Multiplier (e.g., 1.25)" },
  { value: "flat_addition", label: "Flat Amount Addition (₹)" },
  { value: "conditional_discount", label: "Conditional Discount (₹)" },
] as const;

export function createDefaultPricingRuleStep(): PricingRuleStepFormValues {
  return {
    price_rule_type: "discount_percentage",
    price_rule_value: "",
  };
}

export function pricingStepFormToData(
  step: PricingRuleStepFormValues,
): PricingRuleStepData {
  if (step.price_rule_type === "conditional_discount") {
    return {
      price_rule_type: step.price_rule_type,
      price_rule_value: null,
      conditional_threshold: step.conditional_threshold,
      conditional_discount_below: step.conditional_discount_below,
      conditional_discount_above_equal: step.conditional_discount_above_equal,
    };
  }

  return {
    price_rule_type: step.price_rule_type,
    price_rule_value: step.price_rule_value,
    conditional_threshold: null,
    conditional_discount_below: null,
    conditional_discount_above_equal: null,
  };
}

export function pricingStepDataToForm(
  step: PricingRuleStepData,
): PricingRuleStepFormValues {
  return {
    price_rule_type: step.price_rule_type,
    price_rule_value: step.price_rule_value?.toString() || "",
    conditional_threshold: step.conditional_threshold?.toString() || "",
    conditional_discount_below: step.conditional_discount_below?.toString() || "",
    conditional_discount_above_equal:
      step.conditional_discount_above_equal?.toString() || "",
  };
}

export function pricingStepDataToDbRecord(step: PricingRuleStepData) {
  if (step.price_rule_type === "conditional_discount") {
    return {
      price_rule_type: step.price_rule_type,
      price_rule_value: null,
      conditional_threshold:
        step.conditional_threshold != null
          ? Number(step.conditional_threshold)
          : null,
      conditional_discount_below:
        step.conditional_discount_below != null
          ? Number(step.conditional_discount_below)
          : null,
      conditional_discount_above_equal:
        step.conditional_discount_above_equal != null
          ? Number(step.conditional_discount_above_equal)
          : null,
    };
  }

  return {
    price_rule_type: step.price_rule_type,
    price_rule_value:
      step.price_rule_value != null ? Number(step.price_rule_value) : null,
    conditional_threshold: null,
    conditional_discount_below: null,
    conditional_discount_above_equal: null,
  };
}

export function parsePricingRuleSteps(row: DbPricingRuleRow): PricingRuleStepData[] {
  if (
    row.pricing_rule_steps &&
    Array.isArray(row.pricing_rule_steps) &&
    row.pricing_rule_steps.length > 0
  ) {
    return row.pricing_rule_steps;
  }

  const steps: PricingRuleStepData[] = [
    {
      price_rule_type: row.price_rule_type,
      price_rule_value: row.price_rule_value,
      conditional_threshold: row.conditional_threshold,
      conditional_discount_below: row.conditional_discount_below,
      conditional_discount_above_equal: row.conditional_discount_above_equal,
    },
  ];

  if (row.price_rule_type_2) {
    steps.push({
      price_rule_type: row.price_rule_type_2,
      price_rule_value: row.price_rule_value_2,
      conditional_threshold: row.conditional_threshold_2,
      conditional_discount_below: row.conditional_discount_below_2,
      conditional_discount_above_equal: row.conditional_discount_above_equal_2,
    });
  }

  return steps;
}

export function applyPricingRuleStep(
  basePrice: number,
  step: PricingRuleStepData,
): number {
  const ruleValue = Number(step.price_rule_value || 0);

  switch (step.price_rule_type) {
    case "discount_percentage":
      return basePrice * (1 - ruleValue / 100);
    case "discount_flat":
      return Math.max(0, basePrice - ruleValue);
    case "multiplier":
      return basePrice * ruleValue;
    case "flat_addition":
      return basePrice + ruleValue;
    case "conditional_discount": {
      const threshold = Number(step.conditional_threshold || 0);
      const below = Number(step.conditional_discount_below || 0);
      const aboveEqual = Number(step.conditional_discount_above_equal || 0);
      const discount = basePrice > threshold ? aboveEqual : below;
      return Math.max(0, basePrice - discount);
    }
    default:
      return basePrice;
  }
}

export function applyPricingRuleChain(
  basePrice: number,
  steps: PricingRuleStepData[],
): number {
  return steps.reduce(
    (price, step) => applyPricingRuleStep(price, step),
    basePrice,
  );
}

export function applyChainedPricingRules(
  basePrice: number,
  rule: DbPricingRuleRow,
): number {
  return applyPricingRuleChain(basePrice, parsePricingRuleSteps(rule));
}

export function getPricingRuleStepDescription(
  step: PricingRuleStepData,
  basePrice?: number,
): string {
  const ruleValue = Number(step.price_rule_value || 0);

  switch (step.price_rule_type) {
    case "discount_percentage":
      return `${ruleValue}% off`;
    case "discount_flat":
      return `₹${ruleValue} off`;
    case "multiplier":
      return `× ${ruleValue}`;
    case "flat_addition":
      return `+ ₹${ruleValue}`;
    case "conditional_discount": {
      if (basePrice === undefined) return "Conditional discount";
      const threshold = Number(step.conditional_threshold || 0);
      const below = Number(step.conditional_discount_below || 0);
      const aboveEqual = Number(step.conditional_discount_above_equal || 0);
      const selected = basePrice > threshold ? aboveEqual : below;
      return `Conditional: -₹${selected.toFixed(2)}`;
    }
    default:
      return step.price_rule_type;
  }
}

export function getPricingRuleChainDescription(
  basePrice: number,
  steps: PricingRuleStepData[],
): string {
  let running = basePrice;
  const parts: string[] = [];

  for (const step of steps) {
    parts.push(getPricingRuleStepDescription(step, running));
    running = applyPricingRuleStep(running, step);
  }

  return parts.join(" → ");
}

export function validatePricingRuleStep(
  step: PricingRuleStepData,
  label: string,
): string | null {
  if (!step.price_rule_type) {
    return `Please select a rule type for ${label}`;
  }

  if (step.price_rule_type === "conditional_discount") {
    if (
      !step.conditional_threshold ||
      !step.conditional_discount_below ||
      !step.conditional_discount_above_equal
    ) {
      return `Please enter all conditional discount values for ${label}`;
    }
    return null;
  }

  if (!step.price_rule_value && step.price_rule_value !== 0) {
    return `Please enter a rule value for ${label}`;
  }

  return null;
}

function stepToLegacyFirstColumns(step: PricingRuleStepData) {
  if (step.price_rule_type === "conditional_discount") {
    return {
      price_rule_type: step.price_rule_type,
      price_rule_value: null as number | null,
      conditional_threshold: Number(step.conditional_threshold),
      conditional_discount_below: Number(step.conditional_discount_below),
      conditional_discount_above_equal: Number(
        step.conditional_discount_above_equal,
      ),
    };
  }

  return {
    price_rule_type: step.price_rule_type,
    price_rule_value: Number(step.price_rule_value),
    conditional_threshold: null as number | null,
    conditional_discount_below: null as number | null,
    conditional_discount_above_equal: null as number | null,
  };
}

function stepToLegacySecondColumns(step: PricingRuleStepData | undefined) {
  if (!step) {
    return {
      price_rule_type_2: null as string | null,
      price_rule_value_2: null as number | null,
      conditional_threshold_2: null as number | null,
      conditional_discount_below_2: null as number | null,
      conditional_discount_above_equal_2: null as number | null,
    };
  }

  if (step.price_rule_type === "conditional_discount") {
    return {
      price_rule_type_2: step.price_rule_type,
      price_rule_value_2: null as number | null,
      conditional_threshold_2: Number(step.conditional_threshold),
      conditional_discount_below_2: Number(step.conditional_discount_below),
      conditional_discount_above_equal_2: Number(
        step.conditional_discount_above_equal,
      ),
    };
  }

  return {
    price_rule_type_2: step.price_rule_type,
    price_rule_value_2: Number(step.price_rule_value),
    conditional_threshold_2: null as number | null,
    conditional_discount_below_2: null as number | null,
    conditional_discount_above_equal_2: null as number | null,
  };
}

/** Sync first two steps to legacy columns for backward compatibility. */
export function syncLegacyColumnsFromSteps(steps: PricingRuleStepData[]) {
  return {
    ...stepToLegacyFirstColumns(steps[0]),
    ...stepToLegacySecondColumns(steps[1]),
  };
}
