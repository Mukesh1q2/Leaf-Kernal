import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";

function userClient(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "get_my_loyalty",
  title: "Get my loyalty balance",
  description: "Return the signed-in user's loyalty points balance, lifetime points, and current tier.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = userClient(ctx);
    const userId = ctx.getUserId();
    const [{ data: bal }, { data: tier }] = await Promise.all([
      supabase.from("loyalty_balances").select("total_points, lifetime_points").eq("user_id", userId).maybeSingle(),
      supabase.rpc("get_user_tier", { p_user_id: userId }),
    ]);
    const result = { balance: bal ?? { total_points: 0, lifetime_points: 0 }, tier: tier?.[0] ?? null };
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result };
  },
});