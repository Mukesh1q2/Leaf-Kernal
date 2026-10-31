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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");

    if (!razorpayKeyId || !razorpayKeySecret) {
      throw new Error("Razorpay is not configured yet. Please add your Razorpay API keys.");
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error("Invalid token");

    // Get cart items with product data
    const { data: cartItems, error: cartError } = await supabase
      .from("cart_items")
      .select("quantity, product_id, products:product_id(id, name, price, image_url)")
      .eq("user_id", user.id);

    if (cartError) throw cartError;
    if (!cartItems || cartItems.length === 0) throw new Error("Cart is empty");

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const redeemPoints = Math.max(0, parseInt(body?.redeem_points ?? 0, 10) || 0);
    const couponCode = typeof body?.coupon_code === "string" ? body.coupon_code.trim().toUpperCase() : null;

    let subtotal = 0;
    for (const item of cartItems) {
      const product = (item as any).products;
      if (!product) continue;
      subtotal += product.price * item.quantity;
    }

    // Loyalty redemption (server-validated)
    let loyaltyDiscount = 0;
    let loyaltyPointsApplied = 0;
    if (redeemPoints > 0) {
      const { data: settings } = await supabase
        .from("site_settings").select("key,value")
        .in("key", ["loyalty_redeem_rate", "loyalty_max_redeem_pct"]);
      const map = new Map((settings || []).map((r: any) => [r.key, Number(r.value)]));
      const rate = map.get("loyalty_redeem_rate") || 10;
      const maxPct = map.get("loyalty_max_redeem_pct") || 50;
      const maxPoints = Math.floor((subtotal * maxPct / 100) * rate);

      const { data: bal } = await supabase
        .from("loyalty_balances").select("total_points").eq("user_id", user.id).maybeSingle();
      const balance = (bal as any)?.total_points || 0;
      loyaltyPointsApplied = Math.min(redeemPoints, maxPoints, balance);
      loyaltyDiscount = Math.round((loyaltyPointsApplied / Math.max(rate, 1)) * 100) / 100;
    }

    // Coupon discount (server-validated)
    let couponDiscount = 0;
    let validatedCouponId: string | null = null;
    let freeShippingCoupon = false;

    if (couponCode) {
      const cartItemsPayload = cartItems.map((item: any) => ({
        product_id: item.product_id,
        category_id: item.products?.category_id || null,
        price: item.products?.price || 0,
        quantity: item.quantity,
      }));

      const { data: valResult, error: valErr } = await supabase.rpc("validate_coupon", {
        p_code: couponCode,
        p_subtotal: subtotal,
        p_cart_items: cartItemsPayload,
        p_user_id: user.id,
      });

      if (valErr || !valResult || !valResult.valid) {
        throw new Error(valResult?.error || "Invalid or ineligible coupon code");
      }

      couponDiscount = Number(valResult.discount_amount) || 0;
      validatedCouponId = valResult.coupon_id;
      freeShippingCoupon = Boolean(valResult.free_shipping);
    }

    let shipping = subtotal >= 999 ? 0 : 79;
    if (freeShippingCoupon) {
      shipping = 0;
    }

    const totalDiscount = Math.min(subtotal, loyaltyDiscount + couponDiscount);
    const total = Math.max(subtotal + shipping - totalDiscount, 0);

    // Create pending order in DB
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        subtotal,
        shipping,
        total,
        status: "pending",
        loyalty_points_redeemed: loyaltyPointsApplied,
        loyalty_discount: loyaltyDiscount,
        coupon_discount: couponDiscount,
        coupon_code: couponCode,
        coupon_id: validatedCouponId,
        discount: totalDiscount,
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // Deduct points (ledger entry — balance trigger updates)
    if (loyaltyPointsApplied > 0) {
      await supabase.from("loyalty_points").insert({
        user_id: user.id,
        points: -loyaltyPointsApplied,
        type: "redeem",
        order_id: order.id,
        description: "Redeemed at checkout",
      });
    }

    // Create order items
    const orderItems = cartItems.map((item: any) => ({
      order_id: order.id,
      product_id: item.product_id,
      product_name: item.products.name,
      product_image: item.products.image_url,
      price: item.products.price,
      quantity: item.quantity,
    }));

    await supabase.from("order_items").insert(orderItems);

    // Create Razorpay order
    const razorpayAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
    const rzpResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${razorpayAuth}`,
      },
      body: JSON.stringify({
        amount: Math.round(total * 100), // paise
        currency: "INR",
        receipt: order.id,
        notes: {
          order_id: order.id,
          user_id: user.id,
        },
      }),
    });

    if (!rzpResponse.ok) {
      const errBody = await rzpResponse.text();
      throw new Error(`Razorpay error: ${errBody}`);
    }

    const rzpOrder = await rzpResponse.json();

    // Store razorpay order id
    await supabase.from("orders").update({ stripe_session_id: rzpOrder.id }).eq("id", order.id);

    return new Response(JSON.stringify({
      razorpay_order_id: rzpOrder.id,
      razorpay_key_id: razorpayKeyId,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      order_id: order.id,
      user_email: user.email,
      user_name: user.user_metadata?.full_name || "",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
