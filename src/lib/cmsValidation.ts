/**
 * Core validation and sanitization logic for CMS dashboard entities.
 * Used across admin management forms and automated integration tests.
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Parses raw stock quantity input ensuring '0' remains 0 (out of stock)
 * and is not coerced to truthy default values.
 */
export function parseProductStockQuantity(input: string | number | null | undefined, defaultVal = 0): number {
  if (input === null || input === undefined) return defaultVal;
  const str = String(input).trim();
  if (str === "") return defaultVal;
  const parsed = parseInt(str, 10);
  if (isNaN(parsed)) return defaultVal;
  return Math.max(0, parsed);
}

/**
 * Validates product pricing constraints:
 * - Price must be strictly greater than 0
 * - Original price (M.R.P.) cannot be lower than selling price
 */
export function validateProductPricing(price: number, originalPrice?: number | null): ValidationResult {
  if (isNaN(price) || price <= 0) {
    return { valid: false, error: "Product price must be greater than zero." };
  }
  if (originalPrice !== null && originalPrice !== undefined && !isNaN(originalPrice)) {
    if (originalPrice < price) {
      return { valid: false, error: "Original price (M.R.P.) cannot be lower than the selling price." };
    }
  }
  return { valid: true };
}

/**
 * Transforms string into URL-safe lowercase slug
 */
export function generateSlug(text: string): string {
  return (text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

/**
 * Validates slug format and uniqueness
 */
export function validateSlug(
  slug: string,
  currentId?: string | null,
  existingSlugs?: Array<{ id: string; slug: string }>
): ValidationResult {
  const clean = (slug || "").trim();
  if (!clean) {
    return { valid: false, error: "Slug cannot be empty." };
  }
  if (!/^[a-z0-9-]+$/.test(clean)) {
    return { valid: false, error: "Slug must contain only lowercase alphanumeric characters and hyphens." };
  }
  if (existingSlugs && existingSlugs.length > 0) {
    const duplicate = existingSlugs.find(item => item.slug === clean && item.id !== currentId);
    if (duplicate) {
      return { valid: false, error: "A record with this slug already exists. Slugs must be unique." };
    }
  }
  return { valid: true };
}

export interface BundleItemInput {
  product_id: string;
  quantity: number;
}

/**
 * Validates bundle entity before transactional save
 */
export function validateBundleInput(
  name: string,
  slug: string,
  price: number,
  items: BundleItemInput[]
): ValidationResult {
  if (!name || !name.trim()) {
    return { valid: false, error: "Bundle name is required." };
  }
  const slugRes = validateSlug(slug);
  if (!slugRes.valid) return slugRes;

  if (isNaN(price) || price <= 0) {
    return { valid: false, error: "Bundle price must be greater than zero." };
  }
  if (!items || items.length === 0) {
    return { valid: false, error: "A bundle must contain at least one product." };
  }
  for (const item of items) {
    if (!item.product_id || !item.product_id.trim()) {
      return { valid: false, error: "All bundle items must reference a valid product." };
    }
    if (isNaN(item.quantity) || item.quantity < 1) {
      return { valid: false, error: "Bundle item quantity must be at least 1." };
    }
  }
  return { valid: true };
}

export const VALID_ADJUSTMENT_REASONS = [
  "restock",
  "damage",
  "audit_correction",
  "sale_return",
  "manual_adjustment",
] as const;

export type AdjustmentReasonType = typeof VALID_ADJUSTMENT_REASONS[number];

/**
 * Validates inventory stock adjustment input
 */
export function validateInventoryAdjustment(
  currentStock: number,
  newStockInput: string,
  reason: string
): { valid: boolean; error?: string; targetQty?: number; target?: number; delta?: number } {
  const targetQty = parseInt(newStockInput, 10);
  if (isNaN(targetQty) || targetQty < 0) {
    return { valid: false, error: "Stock quantity must be a non-negative number." };
  }
  const delta = targetQty - currentStock;
  if (delta === 0) {
    return { valid: false, error: "The new quantity is identical to current stock." };
  }
  if (!VALID_ADJUSTMENT_REASONS.includes(reason as AdjustmentReasonType)) {
    return { valid: false, error: "Invalid adjustment reason." };
  }
  return { valid: true, targetQty, target: targetQty, delta };
}

/**
 * Validates category inputs
 */
export function validateCategoryInput(name: string, slug: string): ValidationResult {
  if (!name || !name.trim()) {
    return { valid: false, error: "Category name is required." };
  }
  return validateSlug(slug);
}

/**
 * Validates health concern inputs
 */
export function validateHealthConcernInput(name: string, slug: string): ValidationResult {
  if (!name || !name.trim()) {
    return { valid: false, error: "Health concern name is required." };
  }
  return validateSlug(slug);
}
