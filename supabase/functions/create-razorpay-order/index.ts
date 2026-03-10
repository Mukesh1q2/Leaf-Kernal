import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
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

    let subtotal = 0;
    for (const item of cartItems) {
      const product = (item as any).products;
      if (!product) continue;
      subtotal += product.price * item.quantity;
    }

    const shipping = subtotal >= 999 ? 0 : 79;
    const total = subtotal + shipping;

    // Create pending order in DB
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        subtotal,
        shipping,
        total,
        status: "pending",
      })
      .select()
      .single();

    if (orderError) throw orderError;

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
