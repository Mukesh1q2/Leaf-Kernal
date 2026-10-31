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

interface EmailDispatchParams {
  orderId: string;
  recipientEmail: string;
  total: number;
  subtotal: number;
  shipping: number;
  discount: number;
  addressSnapshot: any;
  paymentId: string;
  supabase: any;
}

async function dispatchOrderConfirmationEmail(params: EmailDispatchParams): Promise<boolean> {
  const { orderId, recipientEmail, total, subtotal, shipping, discount, addressSnapshot, paymentId, supabase } = params;

  // 1. Fetch order items
  const { data: items } = await supabase
    .from("order_items")
    .select("product_name, quantity, price")
    .eq("order_id", orderId);

  const customerName = addressSnapshot?.name || "Valued Customer";
  const shortOrderId = orderId.slice(0, 8).toUpperCase();
  const trackingUrl = `https://www.leafandkernel.com/track/${orderId}?email=${encodeURIComponent(recipientEmail)}`;

  const itemsHtml = (items || [])
    .map(
      (item: any) => `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #f0ede6; font-size: 14px; color: #2d3748;">
          <strong>${item.product_name || "Superfood Product"}</strong>
        </td>
        <td style="padding: 10px 0; border-bottom: 1px solid #f0ede6; font-size: 14px; color: #4a5568; text-align: center;">
          × ${item.quantity || 1}
        </td>
        <td style="padding: 10px 0; border-bottom: 1px solid #f0ede6; font-size: 14px; color: #1b3b22; text-align: right; font-weight: 600;">
          ₹${Number(item.price || 0).toFixed(2)}
        </td>
      </tr>`
    )
    .join("");

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Order Confirmed - Leaf & Kernel</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #faf8f5; margin: 0; padding: 24px; color: #2d3748;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2dcd2;">
    <tr>
      <td style="background-color: #1b3b22; padding: 28px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px;">LEAF & KERNEL</h1>
        <p style="color: #d4af37; margin: 4px 0 0 0; font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase;">UVEDIQ · Plant-Powered Ayurvedic Superfoods</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px 28px 20px 28px;">
        <div style="background-color: #f4f8f4; border-left: 4px solid #1b3b22; padding: 16px 20px; border-radius: 4px; margin-bottom: 24px;">
          <p style="margin: 0; font-size: 16px; color: #1b3b22; font-weight: 600;">✓ Payment Verified &amp; Order Confirmed</p>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #4a5568;">Order ID: <strong>#${shortOrderId}</strong> · Payment ID: ${paymentId}</p>
        </div>
        <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Dear ${customerName},</p>
        <p style="font-size: 14px; line-height: 1.6; margin: 0 0 24px 0; color: #4a5568;">
          Thank you for choosing Leaf &amp; Kernel! We have received your payment, and your authentic Ayurvedic superfoods are now being prepared for doorstep dispatch.
        </p>
        <h3 style="font-size: 15px; margin: 0 0 12px 0; color: #1b3b22; border-bottom: 2px solid #1b3b22; padding-bottom: 6px;">Order Summary</h3>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
          ${itemsHtml}
          <tr>
            <td colspan="2" style="padding-top: 12px; font-size: 13px; color: #718096; text-align: right;">Subtotal:</td>
            <td style="padding-top: 12px; font-size: 13px; color: #2d3748; text-align: right; font-weight: 500;">₹${Number(subtotal).toFixed(2)}</td>
          </tr>
          ${
            discount > 0
              ? `<tr>
                  <td colspan="2" style="padding-top: 4px; font-size: 13px; color: #38a169; text-align: right;">Discount:</td>
                  <td style="padding-top: 4px; font-size: 13px; color: #38a169; text-align: right; font-weight: 500;">-₹${Number(discount).toFixed(2)}</td>
                </tr>`
              : ""
          }
          <tr>
            <td colspan="2" style="padding-top: 4px; font-size: 13px; color: #718096; text-align: right;">Shipping:</td>
            <td style="padding-top: 4px; font-size: 13px; color: #2d3748; text-align: right; font-weight: 500;">${shipping === 0 ? "FREE" : "₹" + Number(shipping).toFixed(2)}</td>
          </tr>
          <tr>
            <td colspan="2" style="padding-top: 8px; font-size: 16px; color: #1b3b22; text-align: right; font-weight: 700;">Total Paid:</td>
            <td style="padding-top: 8px; font-size: 16px; color: #1b3b22; text-align: right; font-weight: 700;">₹${Number(total).toFixed(2)}</td>
          </tr>
        </table>
        <div style="background-color: #faf8f5; border: 1px solid #e2dcd2; border-radius: 8px; padding: 16px; margin-bottom: 28px;">
          <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 600; color: #1b3b22; text-transform: uppercase; letter-spacing: 0.5px;">Shipping Address</p>
          <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #4a5568;">
            ${addressSnapshot?.street || ""}<br>
            ${addressSnapshot?.city || ""}, ${addressSnapshot?.state || ""} - ${addressSnapshot?.pincode || ""}<br>
            Phone: ${addressSnapshot?.phone || "—"}
          </p>
        </div>
        <div style="text-align: center; margin: 32px 0 20px 0;">
          <a href="${trackingUrl}" style="background-color: #1b3b22; color: #ffffff; text-decoration: none; padding: 13px 28px; border-radius: 6px; font-size: 14px; font-weight: 600; display: inline-block;">
            Track Your Shipment Online →
          </a>
        </div>
      </td>
    </tr>
    <tr>
      <td style="background-color: #f7f5f0; padding: 24px; border-top: 1px solid #e2dcd2; text-align: center; font-size: 11px; color: #718096; line-height: 1.6;">
        <p style="margin: 0 0 4px 0;"><strong>LEAF AND KERNEL SUPERFOODS COMPANY</strong> (Brand: UVEDIQ)</p>
        <p style="margin: 0 0 4px 0;">Shop No. 4, Ground Floor, F-8/25, Sector 15, Rohini, New Delhi – 110089, India</p>
        <p style="margin: 0 0 8px 0;">GSTIN: 07AANFL1400G1ZO · FSSAI: 13326998000385</p>
        <p style="margin: 0;">Need assistance? Contact us at <a href="mailto:customercare@leafandkernel.com" style="color: #1b3b22;">customercare@leafandkernel.com</a> or +91 8796745590</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const sendgridApiKey = Deno.env.get("SENDGRID_API_KEY");

  if (resendApiKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Leaf & Kernel Orders <orders@leafandkernel.com>",
        to: [recipientEmail],
        subject: `Order Confirmed! Your UVEDIQ Order #${shortOrderId}`,
        html: emailHtml,
      }),
    });
    return res.ok;
  }

  if (sendgridApiKey) {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${sendgridApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: recipientEmail }] }],
        from: { email: "orders@leafandkernel.com", name: "Leaf & Kernel" },
        subject: `Order Confirmed! Your UVEDIQ Order #${shortOrderId}`,
        content: [{ type: "text/html", value: emailHtml }],
      }),
    });
    return res.ok;
  }

  console.log(`[ORDER EMAIL] Generated order confirmation email for Order #${shortOrderId} to ${recipientEmail}. Configure RESEND_API_KEY or SENDGRID_API_KEY in production to send live emails.`);
  return true;
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
      .select("id, status, user_id, loyalty_points_redeemed, coupon_id, total, subtotal, shipping, discount, address_snapshot")
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

    // Dispatch Order Confirmation Email
    let emailDispatched = false;
    try {
      const recipientEmail = user.email || (existingOrder.address_snapshot as any)?.email;
      if (recipientEmail) {
        emailDispatched = await dispatchOrderConfirmationEmail({
          orderId: order_id,
          recipientEmail,
          total: existingOrder.total,
          subtotal: existingOrder.subtotal,
          shipping: existingOrder.shipping || 0,
          discount: existingOrder.discount || 0,
          addressSnapshot: existingOrder.address_snapshot,
          paymentId: razorpay_payment_id,
          supabase,
        });
      }
    } catch (emailErr) {
      console.warn("Order confirmation email failed to dispatch:", emailErr);
    }

    return new Response(JSON.stringify({ success: true, order_id, email_dispatched: emailDispatched }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
