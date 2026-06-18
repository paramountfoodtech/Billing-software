import type { PricingRuleStepFormValues } from "@/components/pricing-rule-step-fields";
import {
  applyPricingRuleChain,
  createDefaultPricingRuleStep,
  parsePricingRuleSteps,
  pricingStepDataToDbRecord,
  pricingStepDataToForm,
  pricingStepFormToData,
  syncLegacyColumnsFromSteps,
  type DbPricingRuleRow,
} from "@/lib/pricing-rules";

export type ProductPricingRuleFormState = {
  product_id: string;
  price_category_id: string;
  notes: string;
  enabled: boolean;
  id?: string;
  fixed_value?: string;
  use_fixed_value?: boolean;
  rule_steps: PricingRuleStepFormValues[];
};

export function mapDbRuleToFormState(
  rule: DbPricingRuleRow & {
    product_id: string;
    price_category_id?: string | null;
    notes?: string | null;
    id?: string;
    fixed_base_value?: number | null;
  },
): ProductPricingRuleFormState {
  const useFixedValue = !!rule.fixed_base_value;
  const steps = parsePricingRuleSteps(rule);

  return {
    product_id: rule.product_id,
    id: rule.id,
    price_category_id: rule.price_category_id || "",
    notes: rule.notes || "",
    enabled: true,
    fixed_value: rule.fixed_base_value?.toString() || "",
    use_fixed_value: useFixedValue,
    rule_steps:
      steps.length > 0
        ? steps.map(pricingStepDataToForm)
        : [createDefaultPricingRuleStep()],
  };
}

export function buildPricingRuleDbPayload(rule: ProductPricingRuleFormState) {
  const stepsData = rule.rule_steps.map(pricingStepFormToData);
  const stepsDb = stepsData.map(pricingStepDataToDbRecord);
  const legacy = syncLegacyColumnsFromSteps(stepsData);

  const payload = {
    ...legacy,
    pricing_rule_steps: stepsDb,
    notes: rule.notes,
    fixed_base_value: null as number | null,
    price_category_id: null as string | null,
  };

  if (rule.use_fixed_value) {
    payload.fixed_base_value = Number(rule.fixed_value);
    payload.price_category_id = null;
  } else {
    payload.price_category_id = rule.price_category_id;
    payload.fixed_base_value = null;
  }

  return payload;
}

export function previewChainedPrice(
  basePrice: number,
  rule: ProductPricingRuleFormState,
): number {
  const steps = rule.rule_steps.map(pricingStepFormToData);
  return applyPricingRuleChain(basePrice, steps);
}
