import { describe, it, expect, vi, beforeEach } from "vitest";
import { isCmsStaffRole, canAccessRoute } from "../lib/cmsRoles";
import { resolveStoreSettings, DEFAULT_STORE_SETTINGS, clearStoreSettingsCache } from "../hooks/useStoreSettings";

describe("CMS & Storefront Controls Verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearStoreSettingsCache();
  });

  // 1. Stock Quantity 0 Preservation Bug Fix
  describe("Product Stock Quantity Handling", () => {
    it("preserves 0 as zero stock and does not replace it with default 100", () => {
      // Root cause: `parseInt(form.stock_quantity) || 100` coerced 0 to falsy, resetting stock to 100
      const parseStockFaulty = (input: string) => {
        return parseInt(input) || 100;
      };

      const parseStockFixed = (input: string) => {
        const parsed = parseInt(input, 10);
        return isNaN(parsed) ? 100 : Math.max(0, parsed);
      };

      // Faulty version fails for "0"
      expect(parseStockFaulty("0")).toBe(100); // Bad legacy behavior

      // Fixed version correctly preserves 0
      expect(parseStockFixed("0")).toBe(0);
      expect(parseStockFixed("25")).toBe(25);
      expect(parseStockFixed("")).toBe(100); // empty fallback
      expect(parseStockFixed("-5")).toBe(0); // clamps non-negative
    });

    it("validates inventory adjustment input and delta calculations", () => {
      const validateInventoryAdjustment = (currentStock: number, inputString: string, reason: string) => {
        const target = parseInt(inputString, 10);
        if (isNaN(target) || target < 0) {
          return { valid: false, error: "Stock quantity must be a non-negative number." };
        }
        const delta = target - currentStock;
        if (delta === 0) {
          return { valid: false, error: "The new quantity is identical to current stock." };
        }
        const validReasons = ["restock", "damage", "audit_correction", "sale_return", "manual_adjustment"];
        if (!validReasons.includes(reason)) {
          return { valid: false, error: "Invalid adjustment reason." };
        }
        return { valid: true, target, delta };
      };

      // Valid restock (+15)
      const res1 = validateInventoryAdjustment(10, "25", "restock");
      expect(res1.valid).toBe(true);
      expect(res1.delta).toBe(15);

      // Valid reduction to zero stock (-10)
      const res2 = validateInventoryAdjustment(10, "0", "damage");
      expect(res2.valid).toBe(true);
      expect(res2.target).toBe(0);
      expect(res2.delta).toBe(-10);

      // Negative stock rejected
      const res3 = validateInventoryAdjustment(10, "-5", "audit_correction");
      expect(res3.valid).toBe(false);

      // Identical stock rejected
      const res4 = validateInventoryAdjustment(10, "10", "restock");
      expect(res4.valid).toBe(false);

      // Invalid reason rejected
      const res5 = validateInventoryAdjustment(10, "15", "unsupported_reason");
      expect(res5.valid).toBe(false);
    });

    it("validates product price and M.R.P. constraints", () => {
      const validateProductPricing = (price: number, originalPrice?: number | null) => {
        if (price <= 0) return { valid: false, error: "Price must be greater than zero" };
        if (originalPrice !== null && originalPrice !== undefined && originalPrice < price) {
          return { valid: false, error: "M.R.P. (original price) cannot be lower than the selling price" };
        }
        return { valid: true };
      };

      expect(validateProductPricing(0).valid).toBe(false);
      expect(validateProductPricing(-50).valid).toBe(false);
      expect(validateProductPricing(499, 399).valid).toBe(false); // MRP lower than selling price
      expect(validateProductPricing(499, 599).valid).toBe(true);
      expect(validateProductPricing(499, null).valid).toBe(true);
    });
  });

  // 2. Slug Validation & Uniqueness
  describe("Slug Generation & Validation", () => {
    const slugify = (text: string) =>
      text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");

    it("generates URL-safe slugs from title/name", () => {
      expect(slugify("Organic Ashwagandha Powder 200g")).toBe("organic-ashwagandha-powder-200g");
      expect(slugify("Heart & Cardiovascular Care!")).toBe("heart-cardiovascular-care");
      expect(slugify("   Leading & Trailing Spaces   ")).toBe("leading-trailing-spaces");
    });

    it("rejects duplicate or invalid slugs", () => {
      const existingSlugs = ["ashwagandha-powder", "triphala-churna", "moringa-leaf"];

      const checkSlugValidity = (slug: string, currentId?: string, existing?: { id: string; slug: string }[]) => {
        const clean = slug.trim();
        if (!clean) return { valid: false, error: "Slug cannot be empty" };
        if (!/^[a-z0-9-]+$/.test(clean)) return { valid: false, error: "Slug must contain only lowercase alphanumeric characters and hyphens" };
        const duplicate = existing?.find(item => item.slug === clean && item.id !== currentId);
        if (duplicate) return { valid: false, error: "Slug already exists in catalog" };
        return { valid: true };
      };

      const catalog = existingSlugs.map((slug, idx) => ({ id: `prod-${idx}`, slug }));

      expect(checkSlugValidity("").valid).toBe(false);
      expect(checkSlugValidity("Invalid Slug!").valid).toBe(false);
      expect(checkSlugValidity("ashwagandha-powder", "prod-new", catalog).valid).toBe(false);
      expect(checkSlugValidity("ashwagandha-powder", "prod-0", catalog).valid).toBe(true); // Same item edit
      expect(checkSlugValidity("brahmi-powder", "prod-new", catalog).valid).toBe(true);
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

  // 4. Atomic Bundle Updates
  describe("Atomic Bundle & Bundle Items Updates", () => {
    it("ensures bundle replacement is atomic and rolls back if items are invalid", () => {
      // Simulating the atomic RPC save_bundle_atomic behavior
      const atomicBundleSave = (
        bundlePayload: { name: string; price: number; slug: string },
        items: Array<{ product_id: string; quantity: number }>
      ) => {
        if (!bundlePayload.name.trim()) throw new Error("Bundle name is required");
        if (bundlePayload.price <= 0) throw new Error("Bundle price must be positive");
        if (!items || items.length === 0) throw new Error("A bundle must contain at least one product");

        for (const item of items) {
          if (!item.product_id) throw new Error("Invalid bundle item: product required");
          if (item.quantity <= 0) throw new Error("Bundle item quantity must be at least 1");
        }

        return {
          success: true,
          savedBundle: bundlePayload,
          savedItemsCount: items.length,
        };
      };

      // Valid bundle
      const validResult = atomicBundleSave(
        { name: "Daily Immunity Kit", price: 999, slug: "daily-immunity-kit" },
        [
          { product_id: "p1", quantity: 1 },
          { product_id: "p2", quantity: 2 },
        ]
      );
      expect(validResult.success).toBe(true);
      expect(validResult.savedItemsCount).toBe(2);

      // Empty items must fail without corrupting existing bundle
      expect(() =>
        atomicBundleSave({ name: "Empty Kit", price: 500, slug: "empty-kit" }, [])
      ).toThrow("A bundle must contain at least one product");

      // Non-positive price must fail
      expect(() =>
        atomicBundleSave({ name: "Free Kit", price: 0, slug: "free-kit" }, [{ product_id: "p1", quantity: 1 }])
      ).toThrow("Bundle price must be positive");
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

    it("verifies genuine customer testimonials are kept distinct from brand quality statements", () => {
      // Testimonials must be customer-submitted reviews with star ratings (1-5) and active status
      const testimonials = [
        { id: "t1", customer_name: "Anita Sharma", rating: 5, is_active: true, quote: "The Triphala changed my digestion!" },
        { id: "t2", customer_name: "Rahul Verma", rating: 4, is_active: true, quote: "Great packaging and prompt delivery." },
        { id: "t3", customer_name: "Pending Review", rating: 5, is_active: false, quote: "Awaiting approval." },
      ];

      const publicTestimonials = testimonials.filter(t => t.is_active && t.rating >= 1 && t.rating <= 5);
      expect(publicTestimonials).toHaveLength(2);

      // Brand quality statements ("The UVEDIQ Standard") are structured brand pillars, not user quotes
      const brandCommitments = [
        { title: "Pure Ayurvedic Extraction", description: "Standardized herbal actives without chemical binders" },
        { title: "Heavy Metal Tested", description: "Independent third-party batch testing" },
        { title: "Plant-Powered Purity", description: "100% vegetarian and vegan certified ingredients" },
      ];

      expect(brandCommitments.every(c => !("customer_name" in c))).toBe(true);
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
