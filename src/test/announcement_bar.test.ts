import { describe, it, expect } from "vitest";
import {
  validateAnnouncementSchedule,
  isAnnouncementScheduledAndActive,
  getCouponEligibilityState,
  getCouponPriorityScore,
  selectBestAutomaticCoupon,
  formatAnnouncementText,
  formatCouponCallout,
  getActiveAnnouncement,
  type AnnouncementBarConfig,
} from "../lib/announcements";
import { type StorefrontCoupon } from "../lib/couponPromotions";

describe("Storefront Top Announcement Bar & CMS Promotion Linking", () => {
  const baseCoupon: StorefrontCoupon = {
    id: "coupon-festive",
    code: "FESTIVE20",
    discount_type: "percentage",
    discount_value: 20,
    max_discount: 500,
    min_order_value: 999,
    display_title: "Festive Wellness Sale",
    display_message: "Save 20% on all orders",
    valid_from: "2026-10-25T00:00:00Z",
    valid_to: "2026-10-31T23:59:59Z",
    display_from: "2026-10-25T00:00:00Z",
    display_to: "2026-10-31T23:59:59Z",
    applicable_to: "all",
    applicable_ids: [],
  };

  const baseAnnouncement: AnnouncementBarConfig = {
    id: "ann-1",
    name: "Festive Promo Bar",
    is_enabled: true,
    status: "published",
    priority: 10,
    free_shipping_threshold: 999,
    announcement_copy: "Free shipping on orders above ₹{threshold} 🌿 Pure Ayurvedic Superfoods",
    coupon_link_mode: "automatic",
    coupon_template: "Use code {code} for {discount}",
    starts_at: "2026-10-26T00:00:00Z",
    ends_at: "2026-10-31T23:59:59Z",
  };

  const testNow = new Date("2026-10-26T12:00:00Z");

  describe("Schedule Validation", () => {
    it("accepts valid start and end dates where end is after start", () => {
      const res = validateAnnouncementSchedule("2026-10-26T10:00:00Z", "2026-10-28T10:00:00Z");
      expect(res.valid).toBe(true);
    });

    it("accepts open-ended schedules (starts_at only or ends_at only)", () => {
      expect(validateAnnouncementSchedule("2026-10-26T10:00:00Z", null).valid).toBe(true);
      expect(validateAnnouncementSchedule(null, "2026-10-31T10:00:00Z").valid).toBe(true);
      expect(validateAnnouncementSchedule(null, null).valid).toBe(true);
    });

    it("rejects schedule when end date is equal to or before start date", () => {
      const resEqual = validateAnnouncementSchedule("2026-10-26T10:00:00Z", "2026-10-26T10:00:00Z");
      expect(resEqual.valid).toBe(false);
      expect(resEqual.error).toContain("must be after");

      const resBefore = validateAnnouncementSchedule("2026-10-28T10:00:00Z", "2026-10-26T10:00:00Z");
      expect(resBefore.valid).toBe(false);
    });

    it("rejects malformed date strings", () => {
      const res = validateAnnouncementSchedule("not-a-date", "2026-10-28T10:00:00Z");
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Invalid schedule start date");
    });
  });

  describe("Announcement Scheduling & Publication Status", () => {
    it("returns active when enabled, published, and within scheduled window", () => {
      const active = isAnnouncementScheduledAndActive(baseAnnouncement, testNow);
      expect(active).toBe(true);
    });

    it("hides announcement if disabled", () => {
      const active = isAnnouncementScheduledAndActive({ ...baseAnnouncement, is_enabled: false }, testNow);
      expect(active).toBe(false);
    });

    it("hides announcement if saved as draft", () => {
      const active = isAnnouncementScheduledAndActive({ ...baseAnnouncement, status: "draft" }, testNow);
      expect(active).toBe(false);
    });

    it("hides announcement before start date", () => {
      const beforeStart = new Date("2026-10-25T23:59:59Z");
      const active = isAnnouncementScheduledAndActive(baseAnnouncement, beforeStart);
      expect(active).toBe(false);
    });

    it("hides announcement after end date", () => {
      const afterEnd = new Date("2026-11-01T00:00:01Z");
      const active = isAnnouncementScheduledAndActive(baseAnnouncement, afterEnd);
      expect(active).toBe(false);
    });
  });

  describe("Display Priority & Overlapping Announcements", () => {
    it("selects the announcement with the highest priority when multiple are active", () => {
      const lowPriority: AnnouncementBarConfig = {
        ...baseAnnouncement,
        id: "low-prio",
        name: "Evergreen Bar",
        priority: 0,
        announcement_copy: "Evergreen copy",
      };

      const highPriority: AnnouncementBarConfig = {
        ...baseAnnouncement,
        id: "high-prio",
        name: "Flash Sale Bar",
        priority: 100,
        announcement_copy: "Flash sale copy",
      };

      const midPriority: AnnouncementBarConfig = {
        ...baseAnnouncement,
        id: "mid-prio",
        name: "Mid Promo Bar",
        priority: 50,
        announcement_copy: "Mid copy",
      };

      const resolved = getActiveAnnouncement([lowPriority, highPriority, midPriority], [baseCoupon], testNow);
      expect(resolved).not.toBeNull();
      expect(resolved?.id).toBe("high-prio");
      expect(resolved?.announcement_copy).toBe("Flash sale copy");
    });

    it("falls back to lower-priority announcement when higher-priority announcement has expired", () => {
      const expiredHighPriority: AnnouncementBarConfig = {
        ...baseAnnouncement,
        id: "high-expired",
        priority: 100,
        starts_at: "2026-10-20T00:00:00Z",
        ends_at: "2026-10-25T00:00:00Z",
      };

      const evergreenLowPriority: AnnouncementBarConfig = {
        ...baseAnnouncement,
        id: "low-evergreen",
        priority: 5,
        starts_at: null,
        ends_at: null,
      };

      const resolved = getActiveAnnouncement([expiredHighPriority, evergreenLowPriority], [baseCoupon], testNow);
      expect(resolved?.id).toBe("low-evergreen");
    });
  });

  describe("Automatic Coupon Selection", () => {
    it("selects the highest-priority eligible coupon rather than just the newest one", () => {
      const smallOffer: StorefrontCoupon = {
        id: "coupon-small",
        code: "SMALL5",
        discount_type: "percentage",
        discount_value: 5,
        applicable_to: "all",
      };

      const megaSiteWideOffer: StorefrontCoupon = {
        id: "coupon-mega",
        code: "MEGA50",
        discount_type: "percentage",
        discount_value: 50,
        max_discount: 1000,
        applicable_to: "all",
      };

      const targetedOffer: StorefrontCoupon = {
        id: "coupon-targeted",
        code: "TARGETED10",
        discount_type: "percentage",
        discount_value: 30,
        applicable_to: "products",
        applicable_ids: ["product-1"],
      };

      const best = selectBestAutomaticCoupon([smallOffer, targetedOffer, megaSiteWideOffer], testNow);
      expect(best?.code).toBe("MEGA50");
    });

    it("ignores private coupons from automatic selection", () => {
      const privateHighValue: StorefrontCoupon & { show_on_storefront: boolean } = {
        ...baseCoupon,
        code: "SECRET99",
        discount_value: 99,
        show_on_storefront: false, // Private / influencer coupon
      };

      const publicNormal: StorefrontCoupon & { show_on_storefront: boolean } = {
        ...baseCoupon,
        code: "PUBLIC15",
        discount_value: 15,
        show_on_storefront: true,
      };

      const best = selectBestAutomaticCoupon([privateHighValue, publicNormal], testNow);
      expect(best?.code).toBe("PUBLIC15");
    });

    it("ignores expired and not-yet-started coupons from automatic selection", () => {
      const expiredCoupon: StorefrontCoupon = {
        ...baseCoupon,
        code: "EXPIRED",
        valid_to: "2026-10-25T00:00:00Z", // expired before testNow
      };

      const futureCoupon: StorefrontCoupon = {
        ...baseCoupon,
        code: "FUTURE",
        valid_from: "2026-10-28T00:00:00Z", // starts after testNow
      };

      const activeCoupon: StorefrontCoupon = {
        ...baseCoupon,
        code: "ACTIVE10",
        discount_value: 10,
        valid_from: "2026-10-20T00:00:00Z",
        valid_to: "2026-10-31T00:00:00Z",
      };

      const best = selectBestAutomaticCoupon([expiredCoupon, futureCoupon, activeCoupon], testNow);
      expect(best?.code).toBe("ACTIVE10");
    });

    it("ignores depleted coupons where used_count >= max_uses", () => {
      const depletedCoupon: StorefrontCoupon & { max_uses: number; used_count: number } = {
        ...baseCoupon,
        code: "MAXEDOUT",
        max_uses: 100,
        used_count: 100,
      };

      const availableCoupon: StorefrontCoupon = {
        ...baseCoupon,
        code: "AVAILABLE",
      };

      const best = selectBestAutomaticCoupon([depletedCoupon, availableCoupon], testNow);
      expect(best?.code).toBe("AVAILABLE");
    });
  });

  describe("Manual Coupon Linking & Ineligibility Safeguards", () => {
    it("attaches the explicitly selected coupon when it is public and valid", () => {
      const manualAnn: AnnouncementBarConfig = {
        ...baseAnnouncement,
        coupon_link_mode: "manual",
        selected_coupon_id: baseCoupon.id,
        selected_coupon_code: baseCoupon.code,
      };

      const resolved = getActiveAnnouncement([manualAnn], [baseCoupon], testNow);
      expect(resolved?.coupon).not.toBeNull();
      expect(resolved?.coupon?.code).toBe("FESTIVE20");
      expect(resolved?.coupon?.discount_label).toBe("20% OFF (Max ₹500)");
    });

    it("safely omits the coupon portion if selected coupon is expired", () => {
      const expiredCoupon: StorefrontCoupon = {
        ...baseCoupon,
        id: "coupon-expired",
        code: "EXPIRED20",
        valid_to: "2026-10-24T00:00:00Z",
      };

      const manualAnn: AnnouncementBarConfig = {
        ...baseAnnouncement,
        coupon_link_mode: "manual",
        selected_coupon_id: "coupon-expired",
        selected_coupon_code: "EXPIRED20",
      };

      const resolved = getActiveAnnouncement([manualAnn], [expiredCoupon], testNow);
      // Main announcement copy should remain, but coupon callout must be null
      expect(resolved).not.toBeNull();
      expect(resolved?.coupon).toBeNull();
    });

    it("safely omits coupon portion if selected coupon is private", () => {
      const privateCoupon: StorefrontCoupon & { show_on_storefront: boolean } = {
        ...baseCoupon,
        id: "coupon-priv",
        code: "PRIVATEVIP",
        show_on_storefront: false,
      };

      const manualAnn: AnnouncementBarConfig = {
        ...baseAnnouncement,
        coupon_link_mode: "manual",
        selected_coupon_id: "coupon-priv",
        selected_coupon_code: "PRIVATEVIP",
      };

      const resolved = getActiveAnnouncement([manualAnn], [privateCoupon], testNow);
      expect(resolved?.coupon).toBeNull();
    });

    it("omits coupon callout when coupon_link_mode is 'none'", () => {
      const noneAnn: AnnouncementBarConfig = {
        ...baseAnnouncement,
        coupon_link_mode: "none",
        selected_coupon_id: baseCoupon.id,
      };

      const resolved = getActiveAnnouncement([noneAnn], [baseCoupon], testNow);
      expect(resolved).not.toBeNull();
      expect(resolved?.coupon).toBeNull();
      expect(resolved?.announcement_copy).toContain("Free shipping");
    });
  });

  describe("Template & Threshold Formatting", () => {
    it("interpolates {threshold} accurately in announcement copy", () => {
      const text = formatAnnouncementText("Free shipping above ₹{threshold} on all orders!", {
        threshold: 1499,
      });
      expect(text).toBe("Free shipping above ₹1499 on all orders!");
    });

    it("interpolates coupon template tokens correctly", () => {
      const template = "Use code {code} for {discount}! ({terms})";
      const callout = formatCouponCallout(template, baseCoupon, { threshold: 999 });

      expect(callout).toContain("Use code FESTIVE20 for 20% OFF (Max ₹500)!");
      expect(callout).toContain("Min order ₹999");
      expect(callout).not.toContain("{code}");
      expect(callout).not.toContain("{discount}");
      expect(callout).not.toContain("{terms}");
    });

    it("handles templates without optional terms gracefully", () => {
      const template = "Save {discount} with code {code}";
      const callout = formatCouponCallout(template, baseCoupon);
      expect(callout).toBe("Save 20% OFF (Max ₹500) with code FESTIVE20");
    });
  });

  describe("Storefront Return Sanitization", () => {
    it("returns only public storefront fields without administrative metadata or internal rules", () => {
      const sensitiveCoupon: StorefrontCoupon & {
        used_count?: number;
        per_customer_limit?: number;
        created_at?: string;
      } = {
        ...baseCoupon,
        used_count: 42,
        per_customer_limit: 1,
        created_at: "2026-10-25T00:00:00Z",
      };

      const resolved = getActiveAnnouncement([baseAnnouncement], [sensitiveCoupon], testNow);
      expect(resolved).not.toBeNull();
      expect(resolved?.coupon).toBeDefined();

      const couponKeys = Object.keys(resolved!.coupon!);
      expect(couponKeys).toContain("code");
      expect(couponKeys).toContain("discount_label");
      expect(couponKeys).toContain("formatted_callout");
      // Internal fields should not be present
      expect(couponKeys).not.toContain("used_count");
      expect(couponKeys).not.toContain("per_customer_limit");
      expect(couponKeys).not.toContain("created_at");
    });
  });
});
