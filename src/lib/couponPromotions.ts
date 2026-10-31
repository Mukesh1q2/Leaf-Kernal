import { supabase } from "@/integrations/supabase/client";

export interface StorefrontCoupon {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed" | "free_shipping";
  discount_value: number;
  max_discount?: number | null;
  min_order_value?: number | null;
  display_title?: string | null;
  display_message?: string | null;
  display_from?: string | null;
  display_to?: string | null;
  valid_from?: string | null;
  valid_to?: string | null;
  applicable_to?: "all" | "categories" | "products" | null;
  applicable_ids?: string[] | null;
}

export interface CouponCartItem {
  product_id: string;
  category_id?: string | null;
  price: number;
  quantity: number;
}

export interface CouponValidationResult {
  valid: boolean;
  error?: string;
  coupon_id?: string;
  code?: string;
  discount_type?: "percentage" | "fixed" | "free_shipping";
  discount_value?: number;
  max_discount?: number | null;
  discount_amount?: number;
  eligible_subtotal?: number;
  free_shipping?: boolean;
  min_order_value?: number | null;
  applicable_to?: "all" | "categories" | "products" | null;
  display_title?: string | null;
  display_message?: string | null;
}

/**
 * Checks if a coupon is currently within its scheduled display window.
 * Visibility schedule is separate from coupon validity schedule.
 */
export function isCouponDisplayScheduled(
  coupon: {
    show_on_storefront?: boolean;
    display_from?: string | null;
    display_to?: string | null;
    is_active?: boolean | null;
  },
  now: Date = new Date()
): boolean {
  if (coupon.is_active === false) return false;
  if (!coupon.show_on_storefront) return false;

  const nowMs = now.getTime();
  if (coupon.display_from) {
    const fromMs = new Date(coupon.display_from).getTime();
    if (isNaN(fromMs) || nowMs < fromMs) return false;
  }
  if (coupon.display_to) {
    const toMs = new Date(coupon.display_to).getTime();
    if (isNaN(toMs) || nowMs >= toMs) return false;
  }
  return true;
}

/**
 * Formats a clean discount label (e.g. "20% OFF", "20% OFF (Up to ₹500)", "₹100 OFF", "FREE SHIPPING")
 */
export function formatDiscountLabel(coupon: {
  discount_type?: string;
  discount_value?: number;
  max_discount?: number | null;
}): string {
  if (coupon.discount_type === "percentage") {
    const base = `${coupon.discount_value}% OFF`;
    if (coupon.max_discount && coupon.max_discount > 0) {
      return `${base} (Max ₹${coupon.max_discount})`;
    }
    return base;
  }
  if (coupon.discount_type === "fixed") {
    return `₹${coupon.discount_value} OFF`;
  }
  if (coupon.discount_type === "free_shipping") {
    return "FREE SHIPPING";
  }
  return "OFFER";
}

/**
 * Formats terms string (minimum order, expiration date, eligibility scope)
 */
export function formatCouponTerms(coupon: {
  min_order_value?: number | null;
  valid_to?: string | null;
  display_to?: string | null;
  applicable_to?: string | null;
}): string {
  const parts: string[] = [];
  if (coupon.min_order_value && coupon.min_order_value > 0) {
    parts.push(`Min order ₹${coupon.min_order_value}`);
  }
  if (coupon.applicable_to === "products") {
    parts.push("Select items only");
  } else if (coupon.applicable_to === "categories") {
    parts.push("Selected category");
  }
  const expiry = coupon.valid_to || coupon.display_to;
  if (expiry) {
    const date = new Date(expiry);
    if (!isNaN(date.getTime())) {
      parts.push(`Ends ${date.toLocaleDateString("en-IN", { month: "short", day: "numeric" })}`);
    }
  }
  return parts.join(" • ");
}

/**
 * Checks whether an offer applies to a given product or category
 */
export function isOfferEligibleForProduct(
  offer: Pick<StorefrontCoupon, "applicable_to" | "applicable_ids">,
  productId: string,
  categoryId?: string | null
): boolean {
  if (!offer.applicable_to || offer.applicable_to === "all") return true;

  if (offer.applicable_to === "products") {
    return Array.isArray(offer.applicable_ids) && offer.applicable_ids.includes(productId);
  }

  if (offer.applicable_to === "categories") {
    return Boolean(
      categoryId && Array.isArray(offer.applicable_ids) && offer.applicable_ids.includes(categoryId)
    );
  }

  return false;
}

/**
 * Pure calculation logic for coupon evaluation (used locally and in unit tests)
 */
export function calculateCouponDiscount(
  coupon: {
    code: string;
    discount_type: "percentage" | "fixed" | "free_shipping";
    discount_value: number;
    max_discount?: number | null;
    min_order_value?: number | null;
    max_uses?: number | null;
    used_count?: number | null;
    per_customer_limit?: number | null;
    is_active?: boolean | null;
    valid_from?: string | null;
    valid_to?: string | null;
    first_order_only?: boolean | null;
    applicable_to?: "all" | "categories" | "products" | null;
    applicable_ids?: string[] | null;
  },
  subtotal: number,
  cartItems: CouponCartItem[] = [],
  options: {
    now?: Date;
    userId?: string | null;
    pastOrderCount?: number;
    userCouponRedemptionCount?: number;
  } = {}
): CouponValidationResult {
  const now = options.now || new Date();

  if (coupon.is_active === false) {
    return { valid: false, error: "This coupon is no longer active" };
  }

  const nowMs = now.getTime();
  if (coupon.valid_from) {
    const fromMs = new Date(coupon.valid_from).getTime();
    if (!isNaN(fromMs) && nowMs < fromMs) {
      return { valid: false, error: "This coupon promotion has not started yet" };
    }
  }

  if (coupon.valid_to) {
    const toMs = new Date(coupon.valid_to).getTime();
    if (!isNaN(toMs) && nowMs > toMs) {
      return { valid: false, error: "This coupon has expired" };
    }
  }

  if (coupon.max_uses != null && (coupon.used_count || 0) >= coupon.max_uses) {
    return { valid: false, error: "This coupon has reached its maximum usage limit" };
  }

  if (coupon.first_order_only && options.userId) {
    if (typeof options.pastOrderCount === "number" && options.pastOrderCount > 0) {
      return { valid: false, error: "This coupon is valid for first orders only" };
    }
  }

  if (
    coupon.per_customer_limit != null &&
    coupon.per_customer_limit > 0 &&
    options.userId &&
    typeof options.userCouponRedemptionCount === "number"
  ) {
    if (options.userCouponRedemptionCount >= coupon.per_customer_limit) {
      return { valid: false, error: "You have already reached the redemption limit for this coupon" };
    }
  }

  // Calculate eligible subtotal
  let eligibleSubtotal = subtotal;
  if (coupon.applicable_to && coupon.applicable_to !== "all") {
    if (cartItems.length > 0) {
      eligibleSubtotal = cartItems.reduce((acc, item) => {
        const isEligible = isOfferEligibleForProduct(coupon, item.product_id, item.category_id);
        return isEligible ? acc + (item.price * item.quantity) : acc;
      }, 0);
    }

    if (eligibleSubtotal <= 0) {
      return {
        valid: false,
        error:
          coupon.applicable_to === "products"
            ? "This coupon is not applicable to any items in your cart"
            : "This coupon is only applicable to specific product categories",
      };
    }
  }

  if (coupon.min_order_value && subtotal < Number(coupon.min_order_value)) {
    return {
      valid: false,
      error: `Minimum order value of ₹${coupon.min_order_value} required for this coupon`,
    };
  }

  let discountAmount = 0;
  if (coupon.discount_type === "percentage") {
    const raw = Math.round((eligibleSubtotal * coupon.discount_value) / 100);
    if (coupon.max_discount && coupon.max_discount > 0) {
      discountAmount = Math.min(raw, coupon.max_discount);
    } else {
      discountAmount = raw;
    }
  } else if (coupon.discount_type === "fixed") {
    discountAmount = Math.min(coupon.discount_value, eligibleSubtotal);
  } else if (coupon.discount_type === "free_shipping") {
    discountAmount = 0;
  }

  return {
    valid: true,
    code: coupon.code,
    discount_type: coupon.discount_type,
    discount_value: coupon.discount_value,
    max_discount: coupon.max_discount,
    discount_amount: discountAmount,
    eligible_subtotal: eligibleSubtotal,
    free_shipping: coupon.discount_type === "free_shipping",
    min_order_value: coupon.min_order_value,
    applicable_to: coupon.applicable_to,
  };
}

/**
 * Fetch active public storefront promotions from the secure view or RPC.
 * Does not expose private, unlisted, or expired coupons.
 */
export async function fetchStorefrontPromotions(params?: {
  productId?: string;
  categoryId?: string;
}): Promise<StorefrontCoupon[]> {
  try {
    // Call the restricted RPC if available
    const { data: rpcData, error: rpcError } = await (supabase.rpc as any)(
      "get_storefront_promotions",
      {
        p_product_id: params?.productId || null,
        p_category_id: params?.categoryId || null,
      }
    );

    if (!rpcError && Array.isArray(rpcData)) {
      return rpcData as StorefrontCoupon[];
    }

    // Fallback: Query the secure storefront view
    const query = supabase
      .from("storefront_active_coupons" as any)
      .select("*");

    const { data, error } = await query;
    if (error || !data) return [];

    let offers = data as StorefrontCoupon[];

    if (params?.productId || params?.categoryId) {
      offers = offers.filter((o) =>
        isOfferEligibleForProduct(o, params?.productId || "", params?.categoryId || null)
      );
    }

    return offers;
  } catch (err) {
    console.warn("Failed to fetch storefront promotions:", err);
    return [];
  }
}

/**
 * Validate a coupon via trusted backend RPC
 */
export async function validateCouponWithBackend(
  code: string,
  subtotal: number,
  cartItems: CouponCartItem[] = [],
  userId?: string | null
): Promise<CouponValidationResult> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) {
    return { valid: false, error: "Please enter a coupon code" };
  }

  try {
    const { data, error } = await (supabase.rpc as any)("validate_coupon", {
      p_code: trimmed,
      p_subtotal: subtotal,
      p_cart_items: cartItems,
      p_user_id: userId || null,
    });

    if (error) {
      console.warn("Coupon RPC error:", error);
      return { valid: false, error: error.message || "Failed to validate coupon" };
    }

    if (data && typeof data === "object") {
      return data as CouponValidationResult;
    }

    return { valid: false, error: "Could not apply coupon" };
  } catch (e: any) {
    return { valid: false, error: e.message || "Error validating coupon" };
  }
}
