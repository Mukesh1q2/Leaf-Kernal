import { supabase } from "@/integrations/supabase/client";

export type QuizAnswers = {
  concerns: string[]; // health_concern slugs
  lifestyle: string;  // active|sedentary|stressed|balanced
  ageBand: string;    // 18-30|31-45|46-60|60+
  format: string;     // powders|capsules|teas|any
};

export type ScoredProduct = {
  product: any;
  score: number;
  reasons: string[];
};

export async function recommendProducts(answers: QuizAnswers, limit = 6): Promise<ScoredProduct[]> {
  // Pull products with category + concerns
  const { data: products } = await supabase
    .from("products")
    .select("*, category:categories(slug,name), product_health_concerns(concern_id, health_concerns(slug,name))")
    .eq("is_active", true);

  if (!products) return [];

  const formatMap: Record<string, string[]> = {
    powders: ["powders"],
    capsules: ["capsules"],
    teas: ["teas-infusions", "teas"],
    any: [],
  };
  const wantedCats = formatMap[answers.format] || [];

  const scored: ScoredProduct[] = products.map((p: any) => {
    let score = 0;
    const reasons: string[] = [];

    // Concern match (3 pts each)
    const productConcerns: string[] = (p.product_health_concerns || [])
      .map((x: any) => x.health_concerns?.slug)
      .filter(Boolean);
    const matchedConcerns = productConcerns.filter((c) => answers.concerns.includes(c));
    if (matchedConcerns.length) {
      score += matchedConcerns.length * 3;
      reasons.push(`Targets ${matchedConcerns.length} of your goals`);
    }

    // Format match (2 pts)
    if (wantedCats.length && p.category?.slug && wantedCats.includes(p.category.slug)) {
      score += 2;
      reasons.push(`${p.category.name} format you prefer`);
    }

    // Lifestyle nudges
    if (answers.lifestyle === "stressed" && productConcerns.some((c) => c.includes("sleep") || c.includes("mind"))) {
      score += 1;
      reasons.push("Calming for stressed days");
    }
    if (answers.lifestyle === "active" && productConcerns.some((c) => c.includes("metabolism") || c.includes("energy") || c.includes("joint"))) {
      score += 1;
      reasons.push("Supports active lifestyle");
    }

    // Age band nudges
    if (answers.ageBand === "60+" && productConcerns.some((c) => c.includes("joint") || c.includes("heart"))) {
      score += 1;
      reasons.push("Recommended for 60+");
    }

    // Rating boost
    score += Math.min(Number(p.rating || 0) / 2, 2.5);
    if ((p.rating || 0) >= 4.5) reasons.push("Top rated by customers");

    return { product: p, score, reasons };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}