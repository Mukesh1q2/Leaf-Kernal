import { supabase } from "@/integrations/supabase/client";

export type ReorderResult = {
  added: number;
  skipped: number;
  unavailable: string[];
};

export async function reorderFromOrder(orderId: string, userId: string): Promise<ReorderResult> {
  const { data: items, error } = await supabase
    .from("order_items")
    .select("product_id, quantity, product_name")
    .eq("order_id", orderId);
  if (error) throw error;
  if (!items?.length) return { added: 0, skipped: 0, unavailable: [] };

  const ids = items.map((i: any) => i.product_id);
  const { data: products } = await supabase
    .from("products")
    .select("id, name, is_active, stock_quantity")
    .in("id", ids);
  const byId = new Map((products || []).map((p: any) => [p.id, p]));

  let added = 0;
  const unavailable: string[] = [];
  for (const item of items) {
    const p: any = byId.get(item.product_id);
    if (!p || !p.is_active || (p.stock_quantity ?? 0) <= 0) {
      unavailable.push(item.product_name);
      continue;
    }
    // Upsert into cart_items: if exists, increment quantity; else insert
    const { data: existing } = await supabase
      .from("cart_items")
      .select("id, quantity")
      .eq("user_id", userId)
      .eq("product_id", item.product_id)
      .maybeSingle();
    if (existing) {
      await supabase
        .from("cart_items")
        .update({ quantity: existing.quantity + item.quantity })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("cart_items")
        .insert({ user_id: userId, product_id: item.product_id, quantity: item.quantity });
    }
    added++;
  }
  return { added, skipped: unavailable.length, unavailable };
}