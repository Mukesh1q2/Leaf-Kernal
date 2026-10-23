/**
 * Google Merchant Center & Meta Catalog Feed Generator
 * 
 * Generates verified, valid product feeds from active products.
 * Excludes drafts, incomplete items, or invalid prices/images.
 * Provides validation diagnostics and XML/CSV exporters.
 */

import { sanitizeCsvCell } from "./adminReports";

export interface FeedProductInput {
  id: string;
  name?: string | null;
  slug?: string | null;
  description?: string | null;
  short_description?: string | null;
  price?: number | string | null;
  original_price?: number | string | null;
  stock_quantity?: number | null;
  image_url?: string | null;
  is_active?: boolean | null;
  badge?: string | null;
}

export interface ValidatedFeedItem {
  id: string;
  title: string;
  description: string;
  link: string;
  imageLink: string;
  availability: "in stock" | "out of stock";
  price: string; // e.g. "599.00 INR"
  salePrice?: string | null;
  brand: string;
  condition: "new";
}

export interface FeedValidationError {
  productId: string;
  productName: string;
  issues: string[];
}

export interface FeedGenerationResult {
  validItems: ValidatedFeedItem[];
  errors: FeedValidationError[];
  totalEvaluated: number;
  totalValid: number;
  totalExcluded: number;
}

export const SITE_URL = "https://leafandkernel.com";
export const BRAND_NAME = "UVEDIQ";

/**
 * Validate and filter active products for Google & Meta shopping catalogs
 */
export function validateAndBuildFeed(products: FeedProductInput[]): FeedGenerationResult {
  const validItems: ValidatedFeedItem[] = [];
  const errors: FeedValidationError[] = [];

  for (const p of products) {
    const issues: string[] = [];
    const name = (p.name || "").trim();

    // 1. Exclude inactive / draft products
    if (!p.is_active) {
      issues.push("Product is inactive or unpublished draft");
    }

    // 2. Validate ID and Title
    if (!p.id) {
      issues.push("Missing required product ID");
    }
    if (!name || name.length < 2) {
      issues.push("Missing or invalid product title");
    }

    // 3. Validate Slug / Link
    if (!p.slug || !p.slug.trim()) {
      issues.push("Missing product slug URL");
    }

    // 4. Validate Price
    const priceNum = Number(p.price);
    if (isNaN(priceNum) || priceNum <= 0) {
      issues.push("Missing or invalid price (must be greater than 0)");
    }

    // 5. Validate Image Link (Must be absolute HTTP/HTTPS URL)
    const img = (p.image_url || "").trim();
    if (!img) {
      issues.push("Missing product image URL");
    } else if (!img.startsWith("http://") && !img.startsWith("https://")) {
      issues.push("Product image must be an absolute HTTPS URL");
    }

    if (issues.length > 0) {
      errors.push({
        productId: p.id || "unknown",
        productName: name || "Unnamed Product",
        issues,
      });
      continue;
    }

    // Build valid feed item
    const desc = (p.short_description || p.description || name).trim();
    const cleanDesc = desc.replace(/<[^>]*>?/gm, "").slice(0, 5000); // Strip HTML
    const inStock = (p.stock_quantity ?? 0) > 0;
    const priceFormatted = `${priceNum.toFixed(2)} INR`;

    validItems.push({
      id: p.id,
      title: name,
      description: cleanDesc,
      link: `${SITE_URL}/product/${p.slug}`,
      imageLink: img,
      availability: inStock ? "in stock" : "out of stock",
      price: priceFormatted,
      brand: BRAND_NAME,
      condition: "new",
    });
  }

  return {
    validItems,
    errors,
    totalEvaluated: products.length,
    totalValid: validItems.length,
    totalExcluded: errors.length,
  };
}

/**
 * Generate Google Merchant Center compliant XML RSS 2.0 Feed
 */
export function generateGoogleMerchantXml(feedItems: ValidatedFeedItem[], isEnabled = true): string {
  if (!isEnabled) {
    throw new Error("Google Merchant Center feed generation is disabled by the Master Administrator.");
  }
  const escapeXml = (unsafe: string) =>
    unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  const itemsXml = feedItems
    .map(
      (item) => `    <item>
      <g:id>${escapeXml(item.id)}</g:id>
      <g:title>${escapeXml(item.title)}</g:title>
      <g:description>${escapeXml(item.description)}</g:description>
      <g:link>${escapeXml(item.link)}</g:link>
      <g:image_link>${escapeXml(item.imageLink)}</g:image_link>
      <g:condition>${item.condition}</g:condition>
      <g:availability>${item.availability}</g:availability>
      <g:price>${escapeXml(item.price)}</g:price>
      <g:brand>${escapeXml(item.brand)}</g:brand>
    </item>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>UVEDIQ Product Catalog</title>
    <link>${SITE_URL}</link>
    <description>Plant-Powered Ayurvedic Superfoods by Leaf &amp; Kernel</description>
${itemsXml}
  </channel>
</rss>`;
}

/**
 * Generate Meta / Facebook & Instagram Catalog CSV Feed
 * Safe against CSV formula injection.
 */
export function generateMetaCatalogCsv(feedItems: ValidatedFeedItem[], isEnabled = true): string {
  if (!isEnabled) {
    throw new Error("Meta Catalog feed generation is disabled by the Master Administrator.");
  }
  const headers = [
    "id",
    "title",
    "description",
    "availability",
    "condition",
    "price",
    "link",
    "image_link",
    "brand",
  ];

  const rows = feedItems.map((item) => [
    item.id,
    item.title,
    item.description,
    item.availability,
    item.condition,
    item.price,
    item.link,
    item.imageLink,
    item.brand,
  ]);

  const headerLine = headers.map((h) => sanitizeCsvCell(h)).join(",");
  const rowLines = rows.map((r) => r.map((c) => sanitizeCsvCell(c)).join(","));

  return [headerLine, ...rowLines].join("\r\n");
}
