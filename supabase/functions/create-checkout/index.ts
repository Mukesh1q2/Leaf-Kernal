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
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!stripeKey) {
      throw new Error("Stripe is not configured yet. Please add your Stripe secret key.");
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Get user from token
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

    // Calculate totals server-side
    const lineItems: any[] = [];
    let subtotal = 0;

    for (const item of cartItems) {
      const product = (item as any).products;
      if (!product) continue;
      const amount = Math.round(product.price * 100); // paise
      subtotal += product.price * item.quantity;
      lineItems.push({
        price_data: {
          currency: "inr",
          product_data: {
            name: product.name,
            images: product.image_url ? [product.image_url] : [],
          },
          unit_amount: amount,
        },
        quantity: item.quantity,
      });
    }

    const shipping = subtotal >= 999 ? 0 : 79;
    const total = subtotal + shipping;

    // Create pending order
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

    // Import Stripe
    const Stripe = (await import("https://esm.sh/stripe@14.21.0")).default;
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    const origin = req.headers.get("origin") || "http://localhost:5173";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancel`,
      customer_email: user.email,
      metadata: { order_id: order.id, user_id: user.id },
      ...(shipping > 0
        ? {
            shipping_options: [
              {
                shipping_rate_data: {
                  type: "fixed_amount",
                  fixed_amount: { amount: shipping * 100, currency: "inr" },
                  display_name: "Standard Shipping",
                },
              },
            ],
          }
        : {}),
    });

    // Store stripe session id
    await supabase.from("orders").update({ stripe_session_id: session.id }).eq("id", order.id);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
