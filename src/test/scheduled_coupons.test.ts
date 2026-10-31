import { describe, it, expect } from "vitest";
import {
  isCouponDisplayScheduled,
  formatDiscountLabel,
  formatCouponTerms,
  isOfferEligibleForProduct,
  calculateCouponDiscount,
  type StorefrontCoupon,
  type CouponCartItem,
} from "../lib/couponPromotions";

describe("Scheduled Storefront Coupon Promotions", () => {
  const baseCoupon: StorefrontCoupon = {
    id: "coupon-1",
    code: "FESTIVE20",
    discount_type: "percentage",
    discount_value: 20,
    max_discount: 500,
    min_order_value: 999,
    display_title: "Festive Wellness Sale",
    display_message: "Get 20% off up to ₹500 on all orders above ₹999",
    display_from: "2026-10-25T10:00:00Z",
    display_to: "2026-10-31T23:59:59Z",
    valid_from: "2026-10-25T00:00:00Z",
    valid_to: "2026-10-31T23:59:59Z",
    applicable_to: "all",
    applicable_ids: [],
  };

  describe("Storefront Display Scheduling", () => {
    it("displays coupon when current time is strictly within the scheduled display window", () => {
      const activeTime = new Date("2026-10-26T12:00:00Z");
      const isVisible = isCouponDisplayScheduled(
        {
          show_on_storefront: true,
          display_from: baseCoupon.display_from,
          display_to: baseCoupon.display_to,
          is_active: true,
        },
        activeTime
      );
      expect(isVisible).toBe(true);
    });

    it("hides coupon from storefront before the scheduled display start time", () => {
      const beforeStart = new Date("2026-10-25T09:59:59Z");
      const isVisible = isCouponDisplayScheduled(
        {
          show_on_storefront: true,
          display_from: baseCoupon.display_from,
          display_to: baseCoupon.display_to,
          is_active: true,
        },
        beforeStart
      );
      expect(isVisible).toBe(false);
    });

    it("hides coupon from storefront after the scheduled display end time", () => {
      const afterEnd = new Date("2026-11-01T00:00:01Z");
      const isVisible = isCouponDisplayScheduled(
        {
          show_on_storefront: true,
          display_from: baseCoupon.display_from,
          display_to: baseCoupon.display_to,
          is_active: true,
        },
        afterEnd
      );
      expect(isVisible).toBe(false);
    });

    it("never displays inactive coupons even within the schedule window", () => {
      const activeTime = new Date("2026-10-26T12:00:00Z");
      const isVisible = isCouponDisplayScheduled(
        {
          show_on_storefront: true,
          display_from: baseCoupon.display_from,
          display_to: baseCoupon.display_to,
          is_active: false,
        },
        activeTime
      );
      expect(isVisible).toBe(false);
    });

    it("separates coupon validity from storefront visibility (private coupon)", () => {
      const activeTime = new Date("2026-10-26T12:00:00Z");

      // Coupon is marked show_on_storefront = false (e.g. VIP/influencer private promo)
      const isVisible = isCouponDisplayScheduled(
        {
          show_on_storefront: false,
          display_from: baseCoupon.display_from,
          display_to: baseCoupon.display_to,
          is_active: true,
        },
        activeTime
      );
      expect(isVisible).toBe(false);

      // But it is valid and can still be applied at checkout with its code!
      const cartItems: CouponCartItem[] = [
        { product_id: "prod-1", price: 1200, quantity: 1 },
      ];
      const result = calculateCouponDiscount(
        {
          code: "VIP50",
          discount_type: "fixed",
          discount_value: 200,
          is_active: true,
          valid_from: "2026-10-01T00:00:00Z",
          valid_to: "2026-11-01T00:00:00Z",
          min_order_value: 500,
        },
        1200,
        cartItems,
        { now: activeTime }
      );

      expect(result.valid).toBe(true);
      expect(result.discount_amount).toBe(200);
    });
  });

  describe("Product & Category Targeting Rules", () => {
    const teaProductId = "prod-tea-1";
    const capsuleProductId = "prod-capsule-1";
    const teaCategoryId = "cat-teas";
    const supplementCategoryId = "cat-supplements";

    it("correctly identifies eligible products for product-specific coupon", () => {
      const productCoupon = {
        applicable_to: "products" as const,
        applicable_ids: [teaProductId],
      };

      expect(isOfferEligibleForProduct(productCoupon, teaProductId)).toBe(true);
      expect(isOfferEligibleForProduct(productCoupon, capsuleProductId)).toBe(false);
    });

    it("correctly identifies eligible products for category-specific coupon", () => {
      const categoryCoupon = {
        applicable_to: "categories" as const,
        applicable_ids: [teaCategoryId],
      };

      expect(isOfferEligibleForProduct(categoryCoupon, teaProductId, teaCategoryId)).toBe(true);
      expect(isOfferEligibleForProduct(categoryCoupon, capsuleProductId, supplementCategoryId)).toBe(false);
    });

    it("applies discount ONLY to eligible products in a mixed cart", () => {
      const targetedCoupon = {
        code: "TEA15",
        discount_type: "percentage" as const,
        discount_value: 20,
        applicable_to: "products" as const,
        applicable_ids: [teaProductId],
        is_active: true,
      };

      const mixedCart: CouponCartItem[] = [
        { product_id: teaProductId, price: 500, quantity: 2 }, // ₹1000 eligible
        { product_id: capsuleProductId, price: 800, quantity: 1 }, // ₹800 NOT eligible
      ];
      const totalSubtotal = 1800;

      const result = calculateCouponDiscount(targetedCoupon, totalSubtotal, mixedCart);
      expect(result.valid).toBe(true);
      expect(result.eligible_subtotal).toBe(1000);
      // 20% of ₹1000 = ₹200 (not 20% of ₹1800)
      expect(result.discount_amount).toBe(200);
    });

    it("rejects coupon if cart contains no eligible products", () => {
      const targetedCoupon = {
        code: "TEA15",
        discount_type: "percentage" as const,
        discount_value: 20,
        applicable_to: "products" as const,
        applicable_ids: [teaProductId],
        is_active: true,
      };

      const ineligibleCart: CouponCartItem[] = [
        { product_id: capsuleProductId, price: 800, quantity: 1 },
      ];

      const result = calculateCouponDiscount(targetedCoupon, 800, ineligibleCart);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not applicable to any items");
    });
  });

  describe("Cart Conditions, Limits & Bounds", () => {
    it("enforces minimum order value requirement", () => {
      const result = calculateCouponDiscount(
        {
          code: "SAVE100",
          discount_type: "fixed",
          discount_value: 100,
          min_order_value: 999,
          is_active: true,
        },
        500 // Below ₹999
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Minimum order value of ₹999 required");
    });

    it("enforces maximum discount cap on percentage discounts", () => {
      const result = calculateCouponDiscount(
        {
          code: "SUPER50",
          discount_type: "percentage",
          discount_value: 50,
          max_discount: 300, // Capped at ₹300
          is_active: true,
        },
        2000 // 50% would be ₹1000, but capped at ₹300
      );

      expect(result.valid).toBe(true);
      expect(result.discount_amount).toBe(300);
    });

    it("handles free shipping coupon discount type properly", () => {
      const result = calculateCouponDiscount(
        {
          code: "FREESHIP",
          discount_type: "free_shipping",
          discount_value: 0,
          min_order_value: 499,
          is_active: true,
        },
        600
      );

      expect(result.valid).toBe(true);
      expect(result.free_shipping).toBe(true);
      expect(result.discount_amount).toBe(0);
    });

    it("enforces global usage limit (exhausted coupons)", () => {
      const result = calculateCouponDiscount(
        {
          code: "LIMITED10",
          discount_type: "fixed",
          discount_value: 100,
          max_uses: 50,
          used_count: 50, // Limit reached
          is_active: true,
        },
        1000
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain("maximum usage limit");
    });

    it("enforces per-customer redemption limit", () => {
      const result = calculateCouponDiscount(
        {
          code: "ONCEONLY",
          discount_type: "fixed",
          discount_value: 100,
          per_customer_limit: 1,
          is_active: true,
        },
        1000,
        [],
        {
          userId: "user-123",
          userCouponRedemptionCount: 1, // User already redeemed once
        }
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain("already reached the redemption limit");
    });

    it("enforces first-order-only restriction", () => {
      // Existing customer with 2 past orders
      const existingCustomerResult = calculateCouponDiscount(
        {
          code: "WELCOME",
          discount_type: "percentage",
          discount_value: 15,
          first_order_only: true,
          is_active: true,
        },
        1000,
        [],
        {
          userId: "user-123",
          pastOrderCount: 2,
        }
      );

      expect(existingCustomerResult.valid).toBe(false);
      expect(existingCustomerResult.error).toContain("first orders only");

      // New customer with 0 past orders
      const newCustomerResult = calculateCouponDiscount(
        {
          code: "WELCOME",
          discount_type: "percentage",
          discount_value: 15,
          first_order_only: true,
          is_active: true,
        },
        1000,
        [],
        {
          userId: "user-new",
          pastOrderCount: 0,
        }
      );

      expect(newCustomerResult.valid).toBe(true);
      expect(newCustomerResult.discount_amount).toBe(150);
    });
  });

  describe("Formatting & Presentation Helpers", () => {
    it("formats discount labels cleanly without misleading jargon", () => {
      expect(formatDiscountLabel({ discount_type: "percentage", discount_value: 20 })).toBe("20% OFF");
      expect(
        formatDiscountLabel({ discount_type: "percentage", discount_value: 20, max_discount: 500 })
      ).toBe("20% OFF (Max ₹500)");
      expect(formatDiscountLabel({ discount_type: "fixed", discount_value: 150 })).toBe("₹150 OFF");
      expect(formatDiscountLabel({ discount_type: "free_shipping" })).toBe("FREE SHIPPING");
    });

    it("formats terms clearly with minimum order and scope", () => {
      const terms = formatCouponTerms({
        min_order_value: 999,
        applicable_to: "products",
        valid_to: "2026-11-15T00:00:00Z",
      });
      expect(terms).toContain("Min order ₹999");
      expect(terms).toContain("Select items only");
      expect(terms).toContain("Ends");
    });
  });
});
