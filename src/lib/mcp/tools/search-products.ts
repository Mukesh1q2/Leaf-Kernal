import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "search_products",
  title: "Search products",
  description: "Search the Leaf & Kernel product catalog by keyword (matches name, description, ingredients, benefits). Returns name, slug, price, rating, stock.",
  inputSchema: {
    query: z.string().min(1).describe("Free-text query — product name, ingredient, benefit, or health concern"),
    limit: z.number().int().min(1).max(20).optional().describe("Max results (default 8)"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }) => {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase
      .from("products")
      .select("name, slug, price, original_price, rating, review_count, stock_quantity, short_description")
      .or(`name.ilike.%${query}%,short_description.ilike.%${query}%,ingredients.ilike.%${query}%,benefits.ilike.%${query}%`)
      .eq("is_active", true)
      .limit(limit ?? 8);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { results: data ?? [] },
    };
  },
});