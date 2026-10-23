/**
 * Explainable On-Site Product Recommendations
 * 
 * Generates transparent, non-sensitive product recommendations based on
 * curated culinary/botanical pairings, shared catalog categories, and bundles.
 * Strictly avoids medical diagnosis or health treatment claims.
 */

export interface ProductCatalogItem {
  id: string;
  name: string;
  slug: string;
  price: number;
  original_price?: number | null;
  category_id?: string | null;
  image_url?: string | null;
  rating?: number | null;
  review_count?: number | null;
  badge?: string | null;
  is_active?: boolean | null;
}

export interface RecommendedProductWithReason {
  product: ProductCatalogItem;
  reason: string;
}

/**
 * Curated pairings grounded in traditional superfood synergy & nutrition (non-medical)
 */
const CURATED_COMPLEMENTS: Record<string, { slug: string; reason: string }[]> = {
  "ashwagandha": [
    { slug: "brahmi", reason: "Traditional botanical pairing for daytime focus and evening balance" },
    { slug: "a2-desi-cow-ghee", reason: "Traditional culinary medium for herbal superfoods" },
  ],
  "moringa": [
    { slug: "spirulina", reason: "Complementary daily green superfood for whole-food nutrition" },
    { slug: "chia-seeds", reason: "Ideal smoothie pairing for plant protein and soluble fiber" },
  ],
  "spirulina": [
    { slug: "moringa", reason: "Complementary daily green superfood for complete plant nutrition" },
    { slug: "chia-seeds", reason: "Rich in plant-based nutrients and micronutrients" },
  ],
  "turmeric": [
    { slug: "flaxseed-oil", reason: "Healthy plant lipids complement turmeric in cooking and smoothies" },
    { slug: "a2-desi-cow-ghee", reason: "Traditional golden milk base for golden spices" },
  ],
  "triphala": [
    { slug: "tulsi-tea", reason: "Gentle daily herbal infusion for evening unwinding" },
    { slug: "chia-seeds", reason: "Natural source of dietary fiber and wholesome sustenance" },
  ],
  "tulsi-tea": [
    { slug: "triphala", reason: "Classic soothing herbal routine" },
    { slug: "moringa", reason: "Invigorating plant-powered morning cup" },
  ],
  "a2-desi-cow-ghee": [
    { slug: "turmeric", reason: "Golden milk classic combination" },
    { slug: "ashwagandha", reason: "Wholesome carrier for traditional root botanicals" },
  ],
  "chia-seeds": [
    { slug: "flaxseed-oil", reason: "Wholesome plant-based omega and seed nutrition" },
    { slug: "moringa", reason: "Rich plant-powered breakfast bowl enhancer" },
  ],
  "flaxseed-oil": [
    { slug: "chia-seeds", reason: "Complementary plant omega seed combination" },
    { slug: "turmeric", reason: "Cold-pressed wholesome oil pairing" },
  ],
};

/**
 * Get explainable recommended products for a given current product
 */
export function getExplainableRecommendations(
  currentProduct: ProductCatalogItem,
  allProducts: ProductCatalogItem[],
  limit = 4
): RecommendedProductWithReason[] {
  if (!currentProduct || !allProducts) return [];

  const results: RecommendedProductWithReason[] = [];
  const addedIds = new Set<string>([currentProduct.id]);
  const activeProducts = allProducts.filter((p) => p.is_active && p.id !== currentProduct.id);

  // 1. Check curated synergy pairings first
  const currentSlugKey = Object.keys(CURATED_COMPLEMENTS).find((key) =>
    currentProduct.slug?.includes(key)
  );

  if (currentSlugKey) {
    const pairings = CURATED_COMPLEMENTS[currentSlugKey];
    for (const pair of pairings) {
      const match = activeProducts.find((p) => p.slug?.includes(pair.slug));
      if (match && !addedIds.has(match.id)) {
        results.push({
          product: match,
          reason: pair.reason,
        });
        addedIds.add(match.id);
        if (results.length >= limit) return results;
      }
    }
  }

  // 2. Check same-category items
  if (currentProduct.category_id) {
    const sameCategory = activeProducts.filter(
      (p) => p.category_id === currentProduct.category_id && !addedIds.has(p.id)
    );
    for (const p of sameCategory) {
      results.push({
        product: p,
        reason: "From the same superfood category",
      });
      addedIds.add(p.id);
      if (results.length >= limit) return results;
    }
  }

  // 3. Fallback to top-rated items in catalog
  const topRated = [...activeProducts]
    .filter((p) => !addedIds.has(p.id))
    .sort((a, b) => (b.rating || 0) - (a.rating || 0));

  for (const p of topRated) {
    results.push({
      product: p,
      reason: "Popular community choice",
    });
    addedIds.add(p.id);
    if (results.length >= limit) break;
  }

  return results;
}
