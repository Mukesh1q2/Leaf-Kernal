import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Leafy 🌿, the AI shopping assistant for Leaf & Kernel — an Indian D2C Ayurvedic superfoods brand.

You can help with:
- Product search & recommendations (use search_products tool to look up live products, prices, stock)
- Order tracking (use get_order_status tool when the user shares an order ID; otherwise ask for it)
- Health goals: energy, gut, sleep, immunity, focus, metabolism (use search_products with a concern keyword)
- FAQs: free shipping above ₹999, COD available on serviceable pincodes, 30-day returns, UPI/Razorpay payments

Style:
- Friendly, concise, India-aware. Reply in user's language; English + Hinglish welcome.
- Use Markdown (bold, bullets) when helpful.
- ALWAYS call the appropriate tool before stating prices, stock, or order status — never invent values.
- Cite product links as /product/<slug> and shop links as /shop?concern=<id> or /shop?category=<id>.
- For order-specific questions without an ID, ask the user for the order ID (first 8 chars are fine) or tell them to visit /account.
`;

const tools = [
  {
    type: "function",
    function: {
      name: "search_products",
      description: "Search live product catalog by keyword (matches name, short description, ingredients, benefits). Returns name, slug, price, original_price, badge, rating, stock, image.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Free-text query — product name, ingredient, benefit, or health concern keyword" },
          limit: { type: "number", description: "Max results (default 5, max 10)" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_order_status",
      description: "Look up an order by its ID (full UUID or first 8 chars). Returns status, totals, items, and latest delivery timeline.",
      parameters: {
        type: "object",
        properties: {
          order_id: { type: "string", description: "Order UUID or first 8 characters" },
        },
        required: ["order_id"],
        additionalProperties: false,
      },
    },
  },
];

function svc() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function execTool(name: string, args: any, userId: string | null) {
  const supabase = svc();
  if (name === "search_products") {
    const q = String(args.query || "").trim();
    const limit = Math.min(Number(args.limit) || 5, 10);
    if (!q) return { results: [] };
    const { data, error } = await supabase
      .from("products")
      .select("name, slug, price, original_price, badge, rating, review_count, stock_quantity, short_description, image_url")
      .or(`name.ilike.%${q}%,short_description.ilike.%${q}%,ingredients.ilike.%${q}%,benefits.ilike.%${q}%`)
      .eq("is_active", true)
      .limit(limit);
    if (error) return { error: error.message };
    return { results: data ?? [] };
  }
  if (name === "get_order_status") {
    if (!userId) return { error: "Please sign in to look up your order." };
    let id = String(args.order_id || "").trim().toLowerCase();
    if (!id) return { error: "order_id required" };
    let q = supabase.from("orders").select("id, status, total, subtotal, shipping, discount, created_at, user_id").eq("user_id", userId);
    q = id.length === 36 ? q.eq("id", id) : q.ilike("id", `${id}%`);
    const { data: orders, error } = await q.limit(1);
    if (error) return { error: error.message };
    const order = orders?.[0];
    if (!order) return { error: "Order not found. Make sure you're logged in with the same account that placed the order." };
    const [{ data: items }, { data: deliveries }] = await Promise.all([
      supabase.from("order_items").select("product_name, quantity, price").eq("order_id", order.id),
      supabase.from("deliveries").select("status, carrier, tracking_id, estimated_delivery, timeline").eq("order_id", order.id).limit(1),
    ]);
    return { order, items: items ?? [], delivery: deliveries?.[0] ?? null };
  }
  return { error: `Unknown tool ${name}` };
}

async function callGateway(body: any) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
  return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, conversation_id, session_id } = await req.json();
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages must be an array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Identify caller
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data } = await userClient.auth.getUser();
        userId = data.user?.id ?? null;
      } catch {}
    }

    const supabase = svc();

    // Ensure conversation exists & persist latest user message
    let convId = conversation_id as string | null;
    const lastUser = [...messages].reverse().find((m: any) => m.role === "user");
    if (!convId) {
      const { data: created } = await supabase
        .from("chat_conversations")
        .insert({
          user_id: userId,
          session_id: userId ? null : session_id,
          title: (lastUser?.content || "New chat").slice(0, 60),
        })
        .select("id")
        .single();
      convId = created?.id ?? null;
    }
    if (convId && lastUser) {
      await supabase.from("chat_messages").insert({
        conversation_id: convId,
        role: "user",
        content: lastUser.content,
      });
    }

    // Tool-calling loop (non-streaming for tool turns), then stream final answer
    const convo: any[] = [{ role: "system", content: SYSTEM_PROMPT }, ...messages];
    let safety = 0;
    while (safety++ < 4) {
      const resp = await callGateway({
        model: "google/gemini-2.5-flash",
        messages: convo,
        tools,
        tool_choice: "auto",
      });
      if (!resp.ok) {
        if (resp.status === 429 || resp.status === 402) {
          return new Response(JSON.stringify({ error: resp.status === 429 ? "Too many messages — try again in a moment." : "AI temporarily unavailable." }),
            { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const t = await resp.text();
        console.error("AI gateway error:", resp.status, t);
        return new Response(JSON.stringify({ error: "AI gateway error" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const data = await resp.json();
      const msg = data.choices?.[0]?.message;
      if (!msg) break;

      const toolCalls = msg.tool_calls || [];
      if (toolCalls.length === 0) {
        // No more tools — stream a final answer using the existing conversation
        convo.push({ role: "assistant", content: msg.content || "" });
        // Persist & return
        if (convId && msg.content) {
          await supabase.from("chat_messages").insert({
            conversation_id: convId,
            role: "assistant",
            content: msg.content,
          });
        }
        return new Response(JSON.stringify({
          conversation_id: convId,
          message: msg.content || "",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Execute tools and continue loop
      convo.push(msg);
      for (const tc of toolCalls) {
        let parsed: any = {};
        try { parsed = JSON.parse(tc.function.arguments || "{}"); } catch {}
        const result = await execTool(tc.function.name, parsed, userId);
        convo.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
    }

    return new Response(JSON.stringify({ error: "Max tool iterations exceeded" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
