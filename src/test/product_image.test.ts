import { describe, it, expect } from "vitest";
import {
  getLocalFallbackImage,
  buildProductAltText,
  DEFAULT_FALLBACK_IMAGE,
} from "../lib/productImages";

describe("Product Images & Fallback Engine", () => {
  describe("getLocalFallbackImage", () => {
    it("returns specific bundled herbal superfood images based on slug keywords", () => {
      const ashwagandha = getLocalFallbackImage("organic-ashwagandha-root-powder");
      expect(ashwagandha).toContain("ashwagandha");

      const moringa = getLocalFallbackImage("moringa-leaf-powder");
      expect(moringa).toContain("moringa");

      const spirulina = getLocalFallbackImage("spirulina-powder-organic");
      expect(spirulina).toContain("spirulina");

      const turmeric = getLocalFallbackImage("lakadong-turmeric-curcumin");
      expect(turmeric).toContain("turmeric");

      const ghee = getLocalFallbackImage("pure-a2-desi-cow-ghee");
      expect(ghee).toContain("ghee");

      const brahmi = getLocalFallbackImage("brahmi-memory-focus");
      expect(brahmi).toContain("brahmi");

      const chia = getLocalFallbackImage("organic-chia-seeds");
      expect(chia).toContain("chia");

      const flax = getLocalFallbackImage("cold-pressed-flax-oil");
      expect(flax).toContain("flax");

      const tulsi = getLocalFallbackImage("holy-basil-tulsi-tea");
      expect(tulsi).toContain("tulsi");

      const bundle = getLocalFallbackImage("immunity-booster-bundle");
      expect(bundle).toContain("bundle");
    });

    it("falls back gracefully to default superfoods image on unknown or empty slug", () => {
      expect(getLocalFallbackImage("mystery-item-xyz")).toBe(DEFAULT_FALLBACK_IMAGE);
      expect(getLocalFallbackImage("")).toBe(DEFAULT_FALLBACK_IMAGE);
      expect(getLocalFallbackImage(null)).toBe(DEFAULT_FALLBACK_IMAGE);
      expect(getLocalFallbackImage(undefined)).toBe(DEFAULT_FALLBACK_IMAGE);
    });
  });

  describe("buildProductAltText", () => {
    it("builds descriptive branded alt text for main product", () => {
      const alt = buildProductAltText("Organic Ashwagandha Root Powder");
      expect(alt).toBe("UVEDIQ Organic Ashwagandha Root Powder - Pure Ayurvedic Plant Nutrition");
    });

    it("includes category when provided", () => {
      const alt = buildProductAltText("Moringa Leaf Powder", { category: "Herbal Powders" });
      expect(alt).toBe("UVEDIQ Moringa Leaf Powder - Premium Herbal Powders");
    });

    it("includes gallery view index when index > 0", () => {
      const alt = buildProductAltText("Spirulina Tablets", { index: 2 });
      expect(alt).toBe("UVEDIQ Spirulina Tablets - Product view 3");
    });

    it("handles null or undefined name gracefully", () => {
      const alt = buildProductAltText(null);
      expect(alt).toBe("UVEDIQ Ayurvedic Superfood - Pure Ayurvedic Plant Nutrition");
    });
  });
});
