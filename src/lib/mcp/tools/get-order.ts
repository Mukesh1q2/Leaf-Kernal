import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

function userClient(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "get_order",
  title: "Get order details",
  description: "Get details for one of the signed-in user's orders, including items and latest delivery status.",
  inputSchema: {
    order_id: z.string().min(4).describe("Order UUID or first 8 characters"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ order_id }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = userClient(ctx);
    const id = order_id.trim().toLowerCase();
    let q = supabase.from("orders").select("id, status, total, subtotal, shipping, discount, created_at");
    q = id.length === 36 ? q.eq("id", id) : q.ilike("id", `${id}%`);
    const { data: orders, error } = await q.limit(1);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const order = orders?.[0];
    if (!order) return { content: [{ type: "text", text: "Order not found" }], isError: true };
    const [{ data: items }, { data: deliveries }] = await Promise.all([
      supabase.from("order_items").select("product_name, quantity, price").eq("order_id", order.id),
      supabase.from("deliveries").select("status, carrier, tracking_id, estimated_delivery, timeline").eq("order_id", order.id).limit(1),
    ]);
    const result = { order, items: items ?? [], delivery: deliveries?.[0] ?? null };
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result };
  },
});