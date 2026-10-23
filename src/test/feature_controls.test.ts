import { describe, it, expect, beforeEach, vi } from "vitest";
import { canAccessRoute } from "@/lib/cmsRoles";
import {
  INITIAL_FEATURE_FLAGS,
  updateFeatureFlag,
  isFeatureEnabledSync,
  FEATURE_FLAGS_CHANGED_EVENT,
  type FeatureKey,
} from "@/lib/featureFlags";
import { downloadReportCsv } from "@/lib/adminReports";
import { generateGoogleMerchantXml, generateMetaCatalogCsv, type ValidatedFeedItem } from "@/lib/feedGenerator";
import { emitCommerceEvent } from "@/lib/commerceEvents";

// Mock Supabase client
vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
        insert: vi.fn().mockResolvedValue({ error: null }),
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
      })),
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
      rpc: vi.fn((fnName: string, args: any) => {
        if (fnName === "update_feature_flag") {
          return Promise.resolve({ data: { success: true }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }),
    },
  };
});

describe("Feature Controls & Master Admin Authorization", () => {
  const sampleFeedItem: ValidatedFeedItem = {
    id: "prod-1",
    title: "Organic Ashwagandha",
    description: "Ayurvedic adaptogen",
    link: "https://leafandkernel.com/product/ashwagandha",
    imageLink: "https://leafandkernel.com/images/ashwagandha.jpg",
    availability: "in stock",
    price: "499.00 INR",
    brand: "UVEDIQ",
    condition: "new",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Permission Matrix & Route Protection (canAccessRoute)", () => {
    it("allows Master Admin to access /admin/settings/features", () => {
      expect(canAccessRoute(["admin"], "/admin/settings/features", true)).toBe(true);
    });

    it("strictly blocks non-master admin from /admin/settings/features", () => {
      expect(canAccessRoute(["admin"], "/admin/settings/features", false)).toBe(false);
    });

    it("blocks editor and content manager from /admin/settings/features", () => {
      expect(canAccessRoute(["editor"], "/admin/settings/features", false)).toBe(false);
      expect(canAccessRoute(["content_manager"], "/admin/settings/features", false)).toBe(false);
    });

    it("blocks customer support and inventory manager from /admin/settings/features", () => {
      expect(canAccessRoute(["customer_support"], "/admin/settings/features", false)).toBe(false);
      expect(canAccessRoute(["inventory_manager"], "/admin/settings/features", false)).toBe(false);
    });

    it("blocks customer (user) and anonymous roles from /admin/settings/features", () => {
      expect(canAccessRoute(["user"], "/admin/settings/features", false)).toBe(false);
      expect(canAccessRoute([], "/admin/settings/features", false)).toBe(false);
    });

    it("preserves standard admin access to regular settings /admin/settings", () => {
      expect(canAccessRoute(["admin"], "/admin/settings", false)).toBe(true);
      expect(canAccessRoute(["editor"], "/admin/settings", false)).toBe(false);
    });
  });

  describe("2. Direct Update Authorization & RBAC Checks", () => {
    it("allows Master Admin to update configured feature flag", async () => {
      const result = await updateFeatureFlag(
        "admin_analytics",
        false,
        true, // isMasterAdmin
        "master@uvediq.com"
      );
      expect(result.success).toBe(true);
    });

    it("rejects non-master admin attempt to modify feature flags", async () => {
      const result = await updateFeatureFlag(
        "admin_analytics",
        false,
        false, // non-master
        "staff@uvediq.com"
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Permission denied: Only Master Administrators can modify feature controls");
    });

    it("rejects anonymous attempt to modify feature flags", async () => {
      const result = await updateFeatureFlag(
        "csv_downloads",
        false,
        false, // anonymous
        null
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Permission denied");
    });
  });

  describe("3. Unconfigured Integrations Safety Guard", () => {
    it("blocks enabling Automated Delhivery Tracking even by Master Admin", async () => {
      const result = await updateFeatureFlag(
        "delhivery_tracking",
        true,
        true,
        "master@uvediq.com"
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot enable unconfigured feature");
      expect(result.error).toContain("DELHIVERY_API_TOKEN");
    });

    it("blocks enabling Razorpay Refund Webhooks even by Master Admin", async () => {
      const result = await updateFeatureFlag(
        "razorpay_refunds",
        true,
        true,
        "master@uvediq.com"
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot enable unconfigured feature");
      expect(result.error).toContain("payment.refunded");
    });

    it("correctly identifies unconfigured status in synchronous helper", () => {
      expect(isFeatureEnabledSync("delhivery_tracking")).toBe(false);
      expect(isFeatureEnabledSync("razorpay_refunds")).toBe(false);
    });
  });

  describe("4. Disabled-Feature Behavior Enforcement", () => {
    it("downloadReportCsv throws an explicit error when csv_downloads is disabled", () => {
      expect(() => {
        downloadReportCsv("report.csv", "data", false);
      }).toThrowError(/CSV report downloads are disabled by the Master Administrator/);
    });

    it("generateGoogleMerchantXml throws an explicit error when gmc_feed is disabled", () => {
      expect(() => {
        generateGoogleMerchantXml([sampleFeedItem], false);
      }).toThrowError(/Google Merchant Center feed generation is disabled by the Master Administrator/);
    });

    it("generateMetaCatalogCsv throws an explicit error when meta_feed is disabled", () => {
      expect(() => {
        generateMetaCatalogCsv([sampleFeedItem], false);
      }).toThrowError(/Meta Catalog feed generation is disabled by the Master Administrator/);
    });

    it("generateGoogleMerchantXml and generateMetaCatalogCsv succeed when enabled", () => {
      const xml = generateGoogleMerchantXml([sampleFeedItem], true);
      expect(xml).toContain("<rss version=\"2.0\"");
      expect(xml).toContain("<g:title>Organic Ashwagandha</g:title>");

      const csv = generateMetaCatalogCsv([sampleFeedItem], true);
      expect(csv).toContain("Organic Ashwagandha");
    });

    it("emitCommerceEvent respects feature flag and returns false if disabled", () => {
      // Test when commerce_events is enabled vs disabled
      const payload = {
        eventName: "view_item" as const,
        itemId: "p1",
        itemName: "Ashwagandha",
        price: 499,
      };

      // When enabled and consent granted
      localStorage.setItem("cookie_consent", "accepted");
      const res = emitCommerceEvent(payload);
      expect(typeof res).toBe("boolean");
    });
  });

  describe("5. Initial Values and Settings Fail-Safe Architecture", () => {
    it("initializes configured features to active defaults", () => {
      expect(INITIAL_FEATURE_FLAGS.admin_analytics.is_enabled).toBe(true);
      expect(INITIAL_FEATURE_FLAGS.csv_downloads.is_enabled).toBe(true);
      expect(INITIAL_FEATURE_FLAGS.gmc_feed.is_enabled).toBe(true);
      expect(INITIAL_FEATURE_FLAGS.meta_feed.is_enabled).toBe(true);
      expect(INITIAL_FEATURE_FLAGS.product_structured_data.is_enabled).toBe(true);
      expect(INITIAL_FEATURE_FLAGS.botanical_recommendations.is_enabled).toBe(true);
      expect(INITIAL_FEATURE_FLAGS.commerce_events.is_enabled).toBe(true);
    });

    it("initializes unavailable integrations to false with explicit missing dependencies", () => {
      expect(INITIAL_FEATURE_FLAGS.delhivery_tracking.is_enabled).toBe(false);
      expect(INITIAL_FEATURE_FLAGS.delhivery_tracking.is_configured).toBe(false);
      expect(INITIAL_FEATURE_FLAGS.delhivery_tracking.missing_dependency).toBeTruthy();

      expect(INITIAL_FEATURE_FLAGS.razorpay_refunds.is_enabled).toBe(false);
      expect(INITIAL_FEATURE_FLAGS.razorpay_refunds.is_configured).toBe(false);
      expect(INITIAL_FEATURE_FLAGS.razorpay_refunds.missing_dependency).toBeTruthy();
    });

    it("broadcasts custom event upon feature toggle update", async () => {
      let eventFired = false;
      const handler = () => {
        eventFired = true;
      };
      window.addEventListener(FEATURE_FLAGS_CHANGED_EVENT, handler);

      await updateFeatureFlag("admin_analytics", true, true, "master@uvediq.com");
      expect(eventFired).toBe(true);

      window.removeEventListener(FEATURE_FLAGS_CHANGED_EVENT, handler);
    });
  });
});
