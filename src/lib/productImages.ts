/**
 * Product Image Resolution & Fallback Engine
 * 
 * Maps product slugs, names, and categories to high-resolution local bundled assets
 * when remote Supabase storage URLs are unavailable, 404, or unconfigured.
 */

import genAshwagandha from "@/assets/gen-ashwagandha.jpg";
import genMoringa from "@/assets/gen-moringa.jpg";
import genSpirulina from "@/assets/gen-spirulina.jpg";
import genTurmeric from "@/assets/gen-turmeric.jpg";
import genA2Ghee from "@/assets/gen-a2-ghee.jpg";
import genBrahmi from "@/assets/gen-brahmi.jpg";
import genChiaSeeds from "@/assets/gen-chia-seeds.jpg";
import genFlaxOil from "@/assets/gen-flax-oil.jpg";
import genImmunityBundle from "@/assets/gen-immunity-bundle.jpg";
import genShatavari from "@/assets/gen-shatavari.jpg";
import genTriphala from "@/assets/gen-triphala.jpg";
import genTulsiTea from "@/assets/gen-tulsi-tea.jpg";

export const DEFAULT_FALLBACK_IMAGE = genMoringa;

/**
 * Keyword-based lookup table for bundled superfood assets
 */
const ASSET_KEYWORDS: { keywords: string[]; asset: string }[] = [
  { keywords: ["ashwagandha", "withania"], asset: genAshwagandha },
  { keywords: ["moringa", "drumstick"], asset: genMoringa },
  { keywords: ["spirulina", "algae"], asset: genSpirulina },
  { keywords: ["turmeric", "curcumin", "haldi", "lakadong"], asset: genTurmeric },
  { keywords: ["ghee", "a2", "desi"], asset: genA2Ghee },
  { keywords: ["brahmi", "bacopa", "memory"], asset: genBrahmi },
  { keywords: ["chia"], asset: genChiaSeeds },
  { keywords: ["flax", "flaxseed", "linseed"], asset: genFlaxOil },
  { keywords: ["shatavari", "asparagus"], asset: genShatavari },
  { keywords: ["triphala", "haritaki", "bibhitaki", "amla"], asset: genTriphala },
  { keywords: ["tulsi", "holy basil", "tea"], asset: genTulsiTea },
  { keywords: ["bundle", "immunity", "kit", "combo", "pack"], asset: genImmunityBundle },
];

/**
 * Resolve the best local fallback asset based on slug or product name
 */
export const getLocalFallbackImage = (slugOrName?: string | null): string => {
  if (!slugOrName) return DEFAULT_FALLBACK_IMAGE;

  const normalized = slugOrName.toLowerCase().replace(/[-_]/g, " ");

  for (const item of ASSET_KEYWORDS) {
    if (item.keywords.some((kw) => normalized.includes(kw))) {
      return item.asset;
    }
  }

  return DEFAULT_FALLBACK_IMAGE;
};

/**
 * Build rich, descriptive, accessibility-compliant alt text for products
 */
export const buildProductAltText = (
  name?: string | null,
  context?: { category?: string | null; index?: number }
): string => {
  const brand = "UVEDIQ";
  const productName = (name || "Ayurvedic Superfood").trim();

  if (context?.index !== undefined && context.index > 0) {
    return `${brand} ${productName} - Product view ${context.index + 1}`;
  }

  if (context?.category) {
    return `${brand} ${productName} - Premium ${context.category}`;
  }

  return `${brand} ${productName} - Pure Ayurvedic Plant Nutrition`;
};
