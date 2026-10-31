import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://leafandkernel.com",
  "https://www.leafandkernel.com",
  "http://localhost:8080",
  "http://localhost:3000",
  "http://localhost:5173",
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!razorpayKeySecret) throw new Error("Razorpay not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error("Invalid token");

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !order_id) {
      throw new Error("Missing payment verification fields");
    }

    // Verify order exists and belongs to authenticated user
    const { data: existingOrder, error: orderCheckErr } = await supabase
      .from("orders")
      .select("id, status, user_id, loyalty_points_redeemed, coupon_id")
      .eq("id", order_id)
      .eq("user_id", user.id)
      .single();

    if (orderCheckErr || !existingOrder) {
      throw new Error("Order not found or access denied");
    }

    // Idempotency: if order is already confirmed, return success
    if (existingOrder.status === "confirmed") {
      return new Response(JSON.stringify({ success: true, order_id, message: "Order already confirmed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify signature using Web Crypto API
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(razorpayKeySecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const data = `${razorpay_order_id}|${razorpay_payment_id}`;
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    if (expectedSignature !== razorpay_signature) {
      // Mark order as cancelled and restore loyalty points if any were deducted
      await supabase.from("orders").update({ status: "cancelled" }).eq("id", order_id).eq("user_id", user.id);
      if (existingOrder.loyalty_points_redeemed && existingOrder.loyalty_points_redeemed > 0) {
        await supabase.from("loyalty_points").insert({
          user_id: user.id,
          points: existingOrder.loyalty_points_redeemed,
          type: "adjust",
          order_id: order_id,
          description: "Refund loyalty points for failed payment verification",
        });
      }
      throw new Error("Payment verification failed - invalid signature");
    }

    // Payment verified - update order status
    await supabase.from("orders").update({
      status: "confirmed",
      stripe_session_id: razorpay_payment_id,
    }).eq("id", order_id).eq("user_id", user.id);

    // Atomically increment coupon usage if a coupon was used
    if (existingOrder.coupon_id) {
      try {
        await supabase.rpc("record_coupon_redemption", {
          p_coupon_id: existingOrder.coupon_id,
          p_order_id: existingOrder.id,
        });
      } catch (couponErr) {
        console.warn("Failed to record coupon redemption:", couponErr);
      }
    }

    // Clear cart
    await supabase.from("cart_items").delete().eq("user_id", user.id);

    return new Response(JSON.stringify({ success: true, order_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
