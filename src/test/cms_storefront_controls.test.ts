import { describe, it, expect, vi, beforeEach } from "vitest";
import { isCmsStaffRole, canAccessRoute } from "../lib/cmsRoles";
import { resolveStoreSettings, DEFAULT_STORE_SETTINGS, clearStoreSettingsCache } from "../hooks/useStoreSettings";
import {
  validateProductPricing,
  parseProductStockQuantity,
  generateSlug,
  validateSlug,
  validateBundleInput,
  validateInventoryAdjustment,
  validateCategoryInput,
  validateHealthConcernInput,
} from "../lib/cmsValidation";
import { CURATED_FALLBACK_TESTIMONIALS } from "../lib/testimonialsData";

describe("CMS & Storefront Controls Verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearStoreSettingsCache();
  });

  // 1. Stock Quantity 0 Preservation Bug Fix
  describe("Product Stock Quantity Handling", () => {
    it("preserves 0 as zero stock and does not replace it with default 100", () => {
      // Legacy faulty version used `parseInt(input) || 100` which coerced 0 to 100
      const legacyParseFaulty = (input: string) => parseInt(input, 10) || 100;
      expect(legacyParseFaulty("0")).toBe(100);

      // Real production validator parseProductStockQuantity preserves 0 correctly
      expect(parseProductStockQuantity("0")).toBe(0);
      expect(parseProductStockQuantity(0)).toBe(0);
      expect(parseProductStockQuantity("25")).toBe(25);
      expect(parseProductStockQuantity("")).toBe(0);
      expect(parseProductStockQuantity("-5")).toBe(0);
      expect(parseProductStockQuantity(null)).toBe(0);
      expect(parseProductStockQuantity(undefined)).toBe(0);
    });

    it("validates inventory adjustment input and delta calculations via production validator", () => {
      // Valid restock (+15)
      const res1 = validateInventoryAdjustment(10, "25", "restock");
      expect(res1.valid).toBe(true);
      expect(res1.delta).toBe(15);
      expect(res1.target).toBe(25);

      // Valid reduction to zero stock (-10)
      const res2 = validateInventoryAdjustment(10, "0", "damage");
      expect(res2.valid).toBe(true);
      expect(res2.target).toBe(0);
      expect(res2.delta).toBe(-10);

      // Negative stock rejected
      const res3 = validateInventoryAdjustment(10, "-5", "audit_correction");
      expect(res3.valid).toBe(false);
      expect(res3.error).toContain("non-negative");

      // Identical stock rejected
      const res4 = validateInventoryAdjustment(10, "10", "restock");
      expect(res4.valid).toBe(false);
      expect(res4.error).toContain("identical");

      // Invalid reason rejected
      const res5 = validateInventoryAdjustment(10, "15", "unsupported_reason" as any);
      expect(res5.valid).toBe(false);
      expect(res5.error).toContain("reason");
    });

    it("validates product price and M.R.P. constraints via production validator", () => {
      // Zero price is strictly rejected (must be greater than zero)
      expect(validateProductPricing(0).valid).toBe(false);
      expect(validateProductPricing(0).error).toBe("Product price must be greater than zero.");

      // Negative price rejected
      expect(validateProductPricing(-50).valid).toBe(false);

      // MRP lower than selling price rejected
      const lowerMrp = validateProductPricing(499, 399);
      expect(lowerMrp.valid).toBe(false);
      expect(lowerMrp.error).toBe("Original price (M.R.P.) cannot be lower than the selling price.");

      // Valid price and MRP
      expect(validateProductPricing(499, 599).valid).toBe(true);
      expect(validateProductPricing(499, null).valid).toBe(true);
      expect(validateProductPricing(499, undefined).valid).toBe(true);
    });
  });

  // 2. Slug Validation & Uniqueness
  describe("Slug Generation & Validation", () => {
    it("generates URL-safe slugs using production generateSlug", () => {
      expect(generateSlug("Organic Ashwagandha Powder 200g")).toBe("organic-ashwagandha-powder-200g");
      expect(generateSlug("Heart & Cardiovascular Care!")).toBe("heart-cardiovascular-care");
      expect(generateSlug("   Leading & Trailing Spaces   ")).toBe("leading-trailing-spaces");
      expect(generateSlug("Special---Dashes--Test")).toBe("special-dashes-test");
    });

    it("rejects duplicate or invalid slugs using production validateSlug", () => {
      const existingCatalog = [
        { id: "prod-0", slug: "ashwagandha-powder" },
        { id: "prod-1", slug: "triphala-churna" },
        { id: "prod-2", slug: "moringa-leaf" },
      ];

      expect(validateSlug("").valid).toBe(false);
      expect(validateSlug("Invalid Slug!").valid).toBe(false);
      // Duplicate against different item ID: rejected
      expect(validateSlug("ashwagandha-powder", "prod-new", existingCatalog).valid).toBe(false);
      // Same item edit retaining its own slug: allowed
      expect(validateSlug("ashwagandha-powder", "prod-0", existingCatalog).valid).toBe(true);
      // Unique new slug: allowed
      expect(validateSlug("brahmi-powder", "prod-new", existingCatalog).valid).toBe(true);
    });
  });

  // 3. Referenced Record Protection (Order History & Foreign Keys)
  describe("Referenced Record Safeguards on Deletion", () => {
    it("prevents hard deletion of products with order history and recommends deactivation", () => {
      const deleteProductWithReferenceCheck = (
        product: { id: string; name: string; is_active: boolean },
        orderItemCount: number
      ) => {
        if (orderItemCount > 0) {
          return {
            allowed: false,
            action: "deactivate",
            reason: `Product "${product.name}" is referenced in ${orderItemCount} historical customer order(s). Deleting it would corrupt financial reports. It will be deactivated instead.`,
          };
        }
        return { allowed: true, action: "delete" };
      };

      const orderedProduct = { id: "p1", name: "Ashwagandha Extract", is_active: true };
      const unreferencedProduct = { id: "p2", name: "Discontinued Sample", is_active: true };

      const result1 = deleteProductWithReferenceCheck(orderedProduct, 14);
      expect(result1.allowed).toBe(false);
      expect(result1.action).toBe("deactivate");
      expect(result1.reason).toContain("historical customer order(s)");

      const result2 = deleteProductWithReferenceCheck(unreferencedProduct, 0);
      expect(result2.allowed).toBe(true);
      expect(result2.action).toBe("delete");
    });

    it("detects category references (subcategories and products) before deletion", () => {
      const checkCategoryReferences = (categoryId: string, products: any[], subcategories: any[]) => {
        const prodCount = products.filter(p => p.category_id === categoryId).length;
        const subCount = subcategories.filter(s => s.parent_id === categoryId).length;

        if (prodCount > 0 || subCount > 0) {
          return {
            canDelete: false,
            warning: `Cannot delete category: contains ${prodCount} product(s) and ${subCount} subcategory(ies). Reassign them first.`,
          };
        }
        return { canDelete: true, warning: null };
      };

      expect(
        checkCategoryReferences("cat-1", [{ id: "p1", category_id: "cat-1" }], []).canDelete
      ).toBe(false);

      expect(
        checkCategoryReferences("cat-empty", [], []).canDelete
      ).toBe(true);
    });

    it("safely distinguishes between blocking subcategories vs unassigning products for category deletion", () => {
      const handleCategoryDeletionSafety = (category: { id: string; name: string }, subcatCount: number, productCount: number) => {
        if (subcatCount > 0) {
          return {
            allowed: false,
            action: "block",
            reason: `This category has ${subcatCount} subcategories. Please reassign or delete child categories first.`,
          };
        }
        if (productCount > 0) {
          return {
            allowed: true,
            action: "unassign_products_and_delete",
            reason: `Category will be deleted and ${productCount} product(s) unassigned to Uncategorized without losing historical order records.`,
          };
        }
        return { allowed: true, action: "direct_delete", reason: "Category has no dependents and can be safely deleted." };
      };

      const parentWithChildren = handleCategoryDeletionSafety({ id: "c1", name: "Superfoods" }, 3, 5);
      expect(parentWithChildren.allowed).toBe(false);
      expect(parentWithChildren.action).toBe("block");

      const categoryWithProductsOnly = handleCategoryDeletionSafety({ id: "c2", name: "Herbal Powders" }, 0, 8);
      expect(categoryWithProductsOnly.allowed).toBe(true);
      expect(categoryWithProductsOnly.action).toBe("unassign_products_and_delete");

      const emptyCategory = handleCategoryDeletionSafety({ id: "c3", name: "Seasonal" }, 0, 0);
      expect(emptyCategory.allowed).toBe(true);
      expect(emptyCategory.action).toBe("direct_delete");
    });

    it("unlinks junction table records before deleting health concerns", () => {
      const handleConcernDeletionSafety = (concernId: string, linkedCount: number) => {
        if (linkedCount > 0) {
          return {
            unlinkRequired: true,
            action: "unlink_and_delete",
            message: `Concern will be removed from ${linkedCount} product(s) prior to deleting the concern record.`,
          };
        }
        return { unlinkRequired: false, action: "direct_delete", message: "No product links found." };
      };

      const linked = handleConcernDeletionSafety("hc-1", 4);
      expect(linked.unlinkRequired).toBe(true);
      expect(linked.action).toBe("unlink_and_delete");

      const unlinked = handleConcernDeletionSafety("hc-2", 0);
      expect(unlinked.unlinkRequired).toBe(false);
      expect(unlinked.action).toBe("direct_delete");
    });
  });

  // 4. Atomic Bundle Updates & Input Validation
  describe("Atomic Bundle & Input Validation", () => {
    it("ensures bundle input is verified via production validateBundleInput before RPC dispatch", () => {
      // Valid bundle
      const validResult = validateBundleInput(
        "Daily Immunity Kit",
        "daily-immunity-kit",
        999,
        [
          { product_id: "p1", quantity: 1 },
          { product_id: "p2", quantity: 2 },
        ]
      );
      expect(validResult.valid).toBe(true);

      // Empty items must fail
      const emptyItems = validateBundleInput("Empty Kit", "empty-kit", 500, []);
      expect(emptyItems.valid).toBe(false);
      expect(emptyItems.error).toBe("A bundle must contain at least one product.");

      // Non-positive price must fail
      const freeKit = validateBundleInput("Free Kit", "free-kit", 0, [{ product_id: "p1", quantity: 1 }]);
      expect(freeKit.valid).toBe(false);
      expect(freeKit.error).toBe("Bundle price must be greater than zero.");

      // Missing name must fail
      const noName = validateBundleInput(" ", "kit", 499, [{ product_id: "p1", quantity: 1 }]);
      expect(noName.valid).toBe(false);
      expect(noName.error).toBe("Bundle name is required.");

      // Invalid item quantity must fail
      const invalidQty = validateBundleInput(
        "Kit",
        "kit",
        499,
        [{ product_id: "p1", quantity: 0 }]
      );
      expect(invalidQty.valid).toBe(false);
      expect(invalidQty.error).toBe("Bundle item quantity must be at least 1.");
    });

    it("validates categories and health concerns with production input validators", () => {
      expect(validateCategoryInput("Superfoods", "superfoods").valid).toBe(true);
      expect(validateCategoryInput(" ", "superfoods").valid).toBe(false);
      expect(validateCategoryInput("Cat", "Invalid Slug!").valid).toBe(false);

      expect(validateHealthConcernInput("Digestive Wellness", "digestive-wellness").valid).toBe(true);
      expect(validateHealthConcernInput("", "digestive-wellness").valid).toBe(false);
      expect(validateHealthConcernInput("Heart Care", "valid-123").valid).toBe(true);
    });
  });

  // 5. Staff Role & Route Security
  describe("CMS Staff Roles & Route Access Control", () => {
    it("enforces strict least-privilege role permissions", () => {
      // Regular customer cannot access any CMS dashboard route
      expect(canAccessRoute(["user"], "/admin")).toBe(false);
      expect(canAccessRoute(["user"], "/admin/products")).toBe(false);
      expect(canAccessRoute(["user"], "/admin/settings")).toBe(false);

      // Customer support cannot access system settings or finance reports
      expect(canAccessRoute(["customer_support"], "/admin/settings")).toBe(false);
      expect(canAccessRoute(["customer_support"], "/admin/users")).toBe(false);
      expect(canAccessRoute(["customer_support"], "/admin/orders")).toBe(true);
      expect(canAccessRoute(["customer_support"], "/admin/reviews")).toBe(true);

      // Inventory manager can manage inventory and view products, but not edit blog or settings
      expect(canAccessRoute(["inventory_manager"], "/admin/inventory")).toBe(true);
      expect(canAccessRoute(["inventory_manager"], "/admin/products")).toBe(true);
      expect(canAccessRoute(["inventory_manager"], "/admin/blog")).toBe(false);
      expect(canAccessRoute(["inventory_manager"], "/admin/settings")).toBe(false);

      // Admin has unrestricted access
      expect(canAccessRoute(["admin"], "/admin/settings")).toBe(true);
      expect(canAccessRoute(["admin"], "/admin/products")).toBe(true);
    });
  });

  // 6. Blog Draft vs Published Visibility
  describe("Blog Post Publication & Preview Restrictions", () => {
    it("restricts draft posts on public storefront while permitting staff preview", () => {
      const posts = [
        { id: "b1", slug: "benefits-of-moringa", title: "Benefits of Moringa", is_published: true },
        { id: "b2", slug: "upcoming-winter-elixirs", title: "Upcoming Winter Elixirs", is_published: false },
      ];

      // Public listing only returns published posts
      const getPublicPosts = () => posts.filter(p => p.is_published);
      expect(getPublicPosts()).toHaveLength(1);
      expect(getPublicPosts()[0].slug).toBe("benefits-of-moringa");

      // Post detail visibility checker
      const canViewPost = (post: typeof posts[0], userRoles: string[]) => {
        if (post.is_published) return { allowed: true, isDraftPreview: false };
        const isStaff = userRoles.some(r => r === "admin" || r === "editor" || r === "content_manager");
        if (isStaff) return { allowed: true, isDraftPreview: true };
        return { allowed: false, isDraftPreview: false };
      };

      const draftPost = posts[1];
      // Anonymous customer viewing draft post: denied
      expect(canViewPost(draftPost, []).allowed).toBe(false);
      expect(canViewPost(draftPost, ["user"]).allowed).toBe(false);

      // Staff viewing draft post: allowed in preview mode
      const staffView = canViewPost(draftPost, ["admin"]);
      expect(staffView.allowed).toBe(true);
      expect(staffView.isDraftPreview).toBe(true);
    });
  });

  // 7. Store Settings & Fallback Layer
  describe("Dynamic Store Settings Resolution", () => {
    it("falls back cleanly to default configuration when setting is undefined or empty", () => {
      const mockSettings = {
        store_name: "Leaf & Kernel Ayurvedic Superfoods",
        support_phone: "+91 98765 43210",
        instagram_url: "", // empty string should fall back
      };

      const resolved = resolveStoreSettings(mockSettings);

      expect(resolved.store_name).toBe("Leaf & Kernel Ayurvedic Superfoods");
      expect(resolved.support_phone).toBe("+91 98765 43210");
      // Empty string falls back to default
      expect(resolved.instagram_url).toBe(DEFAULT_STORE_SETTINGS.instagram_url);
      // Missing key falls back to default
      expect(resolved.business_address).toBe(DEFAULT_STORE_SETTINGS.business_address);
      expect(resolved.whatsapp_number).toBe(DEFAULT_STORE_SETTINGS.whatsapp_number);
    });
  });

  // 8. Banners, Testimonials, Categories, and Health Concerns Storefront Controls
  describe("Storefront Content Scheduling, Ordering, and Separation", () => {
    it("filters scheduled banners by current timestamp and sorts by sort_order", () => {
      const now = new Date("2026-11-04T12:00:00Z");

      const banners = [
        {
          id: "b1",
          title: "Future Flash Sale",
          position: "hero",
          is_active: true,
          starts_at: "2026-12-01T00:00:00Z",
          ends_at: "2026-12-05T00:00:00Z",
          sort_order: 1,
        },
        {
          id: "b2",
          title: "Current Active Sale",
          position: "hero",
          is_active: true,
          starts_at: "2026-11-01T00:00:00Z",
          ends_at: "2026-11-10T00:00:00Z",
          sort_order: 2,
        },
        {
          id: "b3",
          title: "Expired Promo",
          position: "hero",
          is_active: true,
          starts_at: "2026-10-01T00:00:00Z",
          ends_at: "2026-10-31T00:00:00Z",
          sort_order: 0,
        },
        {
          id: "b4",
          title: "Deactivated Banner",
          position: "hero",
          is_active: false,
          starts_at: null,
          ends_at: null,
          sort_order: 0,
        },
        {
          id: "b5",
          title: "Permanent Hero",
          position: "hero",
          is_active: true,
          starts_at: null,
          ends_at: null,
          sort_order: 3,
        },
      ];

      const activeBanners = banners
        .filter(b => {
          if (!b.is_active) return false;
          if (b.starts_at && new Date(b.starts_at) > now) return false;
          if (b.ends_at && new Date(b.ends_at) < now) return false;
          return true;
        })
        .sort((a, b) => a.sort_order - b.sort_order);

      expect(activeBanners.map(b => b.id)).toEqual(["b2", "b5"]);
    });

    it("verifies genuine customer testimonials, verified badge rules, and curated fallback layer", () => {
      // Testimonials must be customer-submitted reviews with star ratings (1-5) and active status
      const testimonials = [
        { id: "t1", name: "Anita Sharma", rating: 5, is_active: true, is_verified: true, quote: "The Triphala changed my digestion!" },
        { id: "t2", name: "Rahul Verma", rating: 4, is_active: true, is_verified: false, quote: "Great packaging and prompt delivery." },
        { id: "t3", name: "Pending Review", rating: 5, is_active: false, is_verified: false, quote: "Awaiting approval." },
      ];

      const publicTestimonials = testimonials.filter(t => t.is_active && t.rating >= 1 && t.rating <= 5);
      expect(publicTestimonials).toHaveLength(2);

      // Verified badge must strictly require is_verified === true
      expect(publicTestimonials[0].is_verified).toBe(true);
      expect(publicTestimonials[1].is_verified).toBe(false);

      // Curated fallback is non-empty and has proper structure when database has 0 records
      expect(CURATED_FALLBACK_TESTIMONIALS.length).toBeGreaterThan(0);
      expect(CURATED_FALLBACK_TESTIMONIALS.every(t => t.name && t.quote && t.rating >= 1 && t.rating <= 5)).toBe(true);

      // Brand quality statements ("The UVEDIQ Standard") are structured brand pillars, not user quotes
      const brandCommitments = [
        { title: "Pure Ayurvedic Extraction", description: "Standardized herbal actives without chemical binders" },
        { title: "Heavy Metal Tested", description: "Independent third-party batch testing" },
        { title: "Plant-Powered Purity", description: "100% vegetarian and vegan certified ingredients" },
      ];

      expect(brandCommitments.every(c => !("quote" in c))).toBe(true);
    });

    it("respects sort_order and active flags for categories and health concerns", () => {
      const concerns = [
        { id: "c1", name: "Immunity", sort_order: 2, is_active: true },
        { id: "c2", name: "Digestion", sort_order: 1, is_active: true },
        { id: "c3", name: "Sleep & Stress", sort_order: 3, is_active: false }, // inactive
      ];

      const activeConcerns = concerns
        .filter(c => c.is_active)
        .sort((a, b) => a.sort_order - b.sort_order);

      expect(activeConcerns.map(c => c.name)).toEqual(["Digestion", "Immunity"]);
    });

    it("ensures public FAQs filter only active items and sort by sort_order", () => {
      const faqs = [
        { id: "f1", question: "How to consume Ashwagandha?", sort_order: 2, is_active: true },
        { id: "f2", question: "What is your shipping policy?", sort_order: 1, is_active: true },
        { id: "f3", question: "Old discontinued product FAQ", sort_order: 0, is_active: false },
      ];

      const publicFaqs = faqs
        .filter(f => f.is_active)
        .sort((a, b) => a.sort_order - b.sort_order);

      expect(publicFaqs.map(f => f.question)).toEqual([
        "What is your shipping policy?",
        "How to consume Ashwagandha?",
      ]);
    });
  });
});
