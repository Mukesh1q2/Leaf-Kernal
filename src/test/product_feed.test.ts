import { describe, it, expect } from "vitest";
import {
  validateAndBuildFeed,
  generateGoogleMerchantXml,
  generateMetaCatalogCsv,
  type FeedProductInput,
} from "../lib/feedGenerator";

describe("Product Feed Generator for Google Merchant & Meta", () => {
  const sampleProducts: FeedProductInput[] = [
    {
      id: "prod-1",
      name: "Organic Ashwagandha Root Powder",
      slug: "organic-ashwagandha-root-powder",
      short_description: "Pure adaptogenic root powder for stress relief.",
      price: 599,
      stock_quantity: 25,
      image_url: "https://leafandkernel.com/images/ashwagandha.jpg",
      is_active: true,
    },
    {
      id: "prod-2",
      name: "Moringa Leaf Powder",
      slug: "moringa-leaf-powder",
      short_description: "<b>Nutrient-rich</b> green superfood.",
      price: "449.50",
      stock_quantity: 0,
      image_url: "https://leafandkernel.com/images/moringa.jpg",
      is_active: true,
    },
    // Invalid: Inactive draft
    {
      id: "prod-3",
      name: "Unreleased Herbal Blend",
      slug: "unreleased-blend",
      price: 999,
      stock_quantity: 10,
      image_url: "https://leafandkernel.com/images/blend.jpg",
      is_active: false,
    },
    // Invalid: Missing image
    {
      id: "prod-4",
      name: "Chia Seeds",
      slug: "organic-chia-seeds",
      price: 399,
      stock_quantity: 50,
      image_url: "",
      is_active: true,
    },
    // Invalid: Zero price
    {
      id: "prod-5",
      name: "Free Sample",
      slug: "free-sample",
      price: 0,
      stock_quantity: 10,
      image_url: "https://leafandkernel.com/images/sample.jpg",
      is_active: true,
    },
  ];

  describe("validateAndBuildFeed", () => {
    it("filters and accepts only active, valid products with valid prices and images", () => {
      const result = validateAndBuildFeed(sampleProducts);

      expect(result.totalEvaluated).toBe(5);
      expect(result.totalValid).toBe(2);
      expect(result.totalExcluded).toBe(3);

      expect(result.validItems).toHaveLength(2);
      expect(result.validItems[0].id).toBe("prod-1");
      expect(result.validItems[0].availability).toBe("in stock");
      expect(result.validItems[0].price).toBe("599.00 INR");
      expect(result.validItems[0].brand).toBe("UVEDIQ");

      // Check out of stock availability
      expect(result.validItems[1].id).toBe("prod-2");
      expect(result.validItems[1].availability).toBe("out of stock");
      expect(result.validItems[1].description).toBe("Nutrient-rich green superfood."); // HTML stripped

      // Check diagnostics
      expect(result.errors).toHaveLength(3);
      expect(result.errors.find((e) => e.productId === "prod-3")?.issues).toContain("Product is inactive or unpublished draft");
      expect(result.errors.find((e) => e.productId === "prod-4")?.issues).toContain("Missing product image URL");
      expect(result.errors.find((e) => e.productId === "prod-5")?.issues).toContain("Missing or invalid price (must be greater than 0)");
    });
  });

  describe("generateGoogleMerchantXml", () => {
    it("generates valid RSS 2.0 XML with Google Merchant elements", () => {
      const { validItems } = validateAndBuildFeed(sampleProducts);
      const xml = generateGoogleMerchantXml(validItems);

      expect(xml).toContain('xmlns:g="http://base.google.com/ns/1.0"');
      expect(xml).toContain("<g:id>prod-1</g:id>");
      expect(xml).toContain("<g:title>Organic Ashwagandha Root Powder</g:title>");
      expect(xml).toContain("<g:brand>UVEDIQ</g:brand>");
      expect(xml).toContain("<g:availability>in stock</g:availability>");
      expect(xml).toContain("<g:price>599.00 INR</g:price>");
      expect(xml).toContain("<g:condition>new</g:condition>");
    });
  });

  describe("generateMetaCatalogCsv", () => {
    it("generates CSV compliant with Meta product catalog standards", () => {
      const { validItems } = validateAndBuildFeed(sampleProducts);
      const csv = generateMetaCatalogCsv(validItems);

      expect(csv).toContain('"id","title","description","availability","condition","price","link","image_link","brand"');
      expect(csv).toContain('"prod-1"');
      expect(csv).toContain('"Organic Ashwagandha Root Powder"');
      expect(csv).toContain('"599.00 INR"');
      expect(csv).toContain('"UVEDIQ"');
    });
  });
});
