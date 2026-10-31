import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const ALLOWED_ORIGINS = [
  "https://leafandkernel.com",
  "https://www.leafandkernel.com",
  // Allow local development
  "http://localhost:8080",
  "http://localhost:3000",
  "http://localhost:5173",
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const SYSTEM_PROMPT = `You are Leafy 🌿, the AI shopping assistant for UVEDIQ by Leaf & Kernel Superfoods Company — an Indian D2C Ayurvedic wellness superfoods brand.

Company & Brand Details:
- Legal Entity: LEAF AND KERNEL SUPERFOODS COMPANY (Brand: UVEDIQ)
- Registered Office: Shop No. 4, Ground Floor, F-8/25, Sector 15, Rohini, New Delhi - 110089, India
- GSTIN: 07AANFL1400G1ZO | FSSAI: 13326998000385
- Customer Support: customercare@leafandkernel.com | +91 8796745590

You can help with:
- Product search & recommendations (use search_products tool to look up live products, prices, stock)
- Order tracking (use get_order_status tool when the user shares an order ID; otherwise ask for it)
- Health goals: energy, gut, sleep, immunity, focus, metabolism (use search_products with a concern keyword)
- FAQs: free shipping above ₹999, 100% plant-based formulations, secure online payments via UPI (GPay, PhonePe, Paytm), Cards & Net Banking via Razorpay. IMPORTANT: Cash on Delivery (COD) is currently unavailable.

Style:
- Friendly, concise, India-aware. Reply in user's language; English + Hinglish welcome.
- Use Markdown (bold, bullets) when helpful.
- ALWAYS call the appropriate tool before stating prices, stock, or order status — never invent values.
- Cite product links as /product/<slug> and shop links as /shop?concern=<id> or /shop?category=<id>.
- For order-specific questions without an ID, ask the user for the order ID (first 8 chars are fine) or tell them to visit /account.
`;

// Gemini-compatible tool definitions
const geminiTools = [
  {
    functionDeclarations: [
      {
        name: "search_products",
        description: "Search live product catalog by keyword (matches name, short description, ingredients, benefits). Returns name, slug, price, original_price, badge, rating, stock, image.",
        parameters: {
          type: "OBJECT",
          properties: {
            query: { type: "STRING", description: "Free-text query — product name, ingredient, benefit, or health concern keyword" },
            limit: { type: "NUMBER", description: "Max results (default 5, max 10)" },
          },
          required: ["query"],
        },
      },
      {
        name: "get_order_status",
        description: "Look up an order by its ID (full UUID or first 8 chars). Returns status, totals, items, and latest delivery timeline.",
        parameters: {
          type: "OBJECT",
          properties: {
            order_id: { type: "STRING", description: "Order UUID or first 8 characters" },
          },
          required: ["order_id"],
        },
      },
    ],
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

// Convert OpenAI-style messages to Gemini contents format
function toGeminiContents(messages: any[]) {
  const contents: any[] = [];
  for (const msg of messages) {
    if (msg.role === "system") continue; // system instruction is passed separately
    if (msg.role === "user") {
      contents.push({ role: "user", parts: [{ text: msg.content }] });
    } else if (msg.role === "assistant") {
      if (msg.content) {
        contents.push({ role: "model", parts: [{ text: msg.content }] });
      }
      // Handle function calls from assistant
      if (msg.tool_calls) {
        const parts = msg.tool_calls.map((tc: any) => ({
          functionCall: {
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments || "{}"),
          },
        }));
        contents.push({ role: "model", parts });
      }
    } else if (msg.role === "tool") {
      contents.push({
        role: "user",
        parts: [{ functionResponse: { name: msg.name || "tool", response: JSON.parse(msg.content || "{}") } }],
      });
    }
  }
  return contents;
}

// Simple in-memory rate limiter
const rateLimits = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string, maxPerMinute: number): boolean {
  const now = Date.now();
  const entry = rateLimits.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= maxPerMinute) return false;
  entry.count++;
  return true;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

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

    // Rate limit: 20 requests/minute per user or IP
    const rateLimitKey = userId || req.headers.get("x-forwarded-for") || "anon";
    if (!checkRateLimit(`chat:${rateLimitKey}`, 20)) {
      return new Response(JSON.stringify({ error: "Too many messages — try again in a moment." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

    // Tool-calling loop with Gemini API
    const convo: any[] = [{ role: "system", content: SYSTEM_PROMPT }, ...messages];
    let safety = 0;
    while (safety++ < 4) {
      const geminiContents = toGeminiContents(convo);

      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: geminiContents,
            tools: geminiTools,
          }),
        }
      );

      if (!resp.ok) {
        if (resp.status === 429) {
          return new Response(JSON.stringify({ error: "Too many messages — try again in a moment." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const t = await resp.text();
        console.error("Gemini API error:", resp.status, t);
        return new Response(JSON.stringify({ error: "AI service error" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const data = await resp.json();
      const candidate = data.candidates?.[0];
      if (!candidate?.content?.parts) break;

      const parts = candidate.content.parts;

      // Check for function calls
      const functionCalls = parts.filter((p: any) => p.functionCall);

      if (functionCalls.length === 0) {
        // No tool calls — extract text response
        const textParts = parts.filter((p: any) => p.text);
        const responseText = textParts.map((p: any) => p.text).join("") || "";

        // Persist & return
        if (convId && responseText) {
          await supabase.from("chat_messages").insert({
            conversation_id: convId,
            role: "assistant",
            content: responseText,
          });
        }
        return new Response(JSON.stringify({
          conversation_id: convId,
          message: responseText,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Execute function calls and add results to conversation
      // Add the assistant's function call to conversation (in OpenAI format for tracking)
      const toolCalls = functionCalls.map((fc: any, i: number) => ({
        id: `call_${i}_${Date.now()}`,
        function: {
          name: fc.functionCall.name,
          arguments: JSON.stringify(fc.functionCall.args || {}),
        },
      }));
      convo.push({ role: "assistant", content: null, tool_calls: toolCalls });

      for (const tc of toolCalls) {
        let parsed: any = {};
        try { parsed = JSON.parse(tc.function.arguments || "{}"); } catch {}
        const result = await execTool(tc.function.name, parsed, userId);
        convo.push({
          role: "tool",
          name: tc.function.name,
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
