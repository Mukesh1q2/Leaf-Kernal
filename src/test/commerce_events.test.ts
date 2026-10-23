import { describe, it, expect, beforeEach, vi } from "vitest";
import { emitCommerceEvent } from "../lib/commerceEvents";
import {
  getExplainableRecommendations,
  type ProductCatalogItem,
} from "../lib/recommendations";

describe("Privacy-First Commerce Events & Explainable Recommendations", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe("emitCommerceEvent", () => {
    it("emits commerce events successfully when consent is not declined", () => {
      const result = emitCommerceEvent({
        eventName: "view_item",
        itemId: "prod-ash",
        itemName: "Ashwagandha",
        price: 599,
      });
      expect(result).toBe(true);
    });

    it("suppresses commerce events when user has declined consent", () => {
      localStorage.setItem("cookie_consent", "declined");
      const result = emitCommerceEvent({
        eventName: "add_to_cart",
        itemId: "prod-mor",
        price: 499,
      });
      expect(result).toBe(false);
    });
  });

  describe("getExplainableRecommendations", () => {
    const catalog: ProductCatalogItem[] = [
      {
        id: "prod-ash",
        name: "Ashwagandha Root Powder",
        slug: "ashwagandha",
        price: 599,
        category_id: "cat-herbs",
        is_active: true,
      },
      {
        id: "prod-brahmi",
        name: "Brahmi Memory Focus",
        slug: "brahmi",
        price: 649,
        category_id: "cat-herbs",
        is_active: true,
      },
      {
        id: "prod-ghee",
        name: "A2 Desi Cow Ghee",
        slug: "a2-desi-cow-ghee",
        price: 1299,
        category_id: "cat-oils",
        is_active: true,
      },
      {
        id: "prod-inactive",
        name: "Draft Formula",
        slug: "draft-formula",
        price: 999,
        category_id: "cat-herbs",
        is_active: false,
      },
    ];

    it("recommends curated botanical pairings with explainable reasons", () => {
      const current = catalog[0]; // Ashwagandha
      const recs = getExplainableRecommendations(current, catalog, 4);

      expect(recs.length).toBeGreaterThan(0);
      expect(recs.some((r) => r.product.slug === "brahmi")).toBe(true);

      const brahmiRec = recs.find((r) => r.product.slug === "brahmi");
      expect(brahmiRec?.reason).toContain("Traditional botanical pairing");

      // Inactive items must NEVER be recommended
      expect(recs.some((r) => r.product.id === "prod-inactive")).toBe(false);

      // Self must NEVER be recommended
      expect(recs.some((r) => r.product.id === current.id)).toBe(false);
    });
  });
});
