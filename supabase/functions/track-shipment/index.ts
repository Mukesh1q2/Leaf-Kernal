import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function mapBigshipStatus(statusOrTag?: string | null): string {
  if (!statusOrTag) return "placed";
  const s = statusOrTag.toLowerCase().trim();
  if (s.includes("rto") || s.includes("undelivered") || s.includes("lost") || s.includes("return")) return "returned";
  if (s.includes("delivered")) return "delivered";
  if (s.includes("out for delivery") || s.includes("out_for_delivery")) return "out_for_delivery";
  if (s.includes("in-transit") || s.includes("in transit") || s.includes("intransit") || s.includes("shipped") || s.includes("hub") || s.includes("picked")) return "shipped";
  if (s.includes("pickup") || s.includes("manifest") || s.includes("packed")) return "packed";
  return "placed";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let awb = "";
    let orderId = "";
    let syncToDb = false;

    if (req.method === "GET") {
      const url = new URL(req.url);
      awb = url.searchParams.get("awb") || url.searchParams.get("tracking_id") || "";
      orderId = url.searchParams.get("order_id") || "";
      syncToDb = url.searchParams.get("sync") === "true";
    } else if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      awb = body.awb || body.tracking_id || "";
      orderId = body.order_id || "";
      syncToDb = Boolean(body.sync);
    }

    // If orderId is provided but awb is missing, fetch awb from database deliveries
    if (!awb && orderId) {
      const { data: d } = await supabase
        .from("deliveries")
        .select("tracking_id")
        .eq("order_id", orderId)
        .maybeSingle();
      if (d?.tracking_id) {
        awb = d.tracking_id;
      }
    }

    if (!awb) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Either AWB (tracking_id) or order_id with an assigned tracking_id must be provided.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call Bigship tracking API
    const bigshipUrl = `https://tracking.bigship.direct/api/show-tracking?track_segment=domestic&track_type=awb&track_value=${encodeURIComponent(awb)}`;
    const bigshipRes = await fetch(bigshipUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "LeafKernelEdgeFunction/1.0",
      },
    });

    if (bigshipRes.status === 404) {
      return new Response(
        JSON.stringify({
          success: false,
          awb,
          error: "Shipment not found in Bigship system yet.",
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!bigshipRes.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          awb,
          error: `Bigship service error (HTTP ${bigshipRes.status}).`,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = await bigshipRes.json();
    const data = payload?.data;

    if (!data) {
      return new Response(
        JSON.stringify({
          success: false,
          awb,
          error: payload?.message || "Invalid response from Bigship tracking service.",
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const checkpoints = Array.isArray(data.checkpoints) ? [...data.checkpoints] : [];
    checkpoints.sort((a: any, b: any) => {
      const timeA = new Date(a.checkpoint_time).getTime() || 0;
      const timeB = new Date(b.checkpoint_time).getTime() || 0;
      return timeB - timeA;
    });

    const latestCheckpoint = checkpoints[0];
    const rawStatus = data.tag || data.order_status || latestCheckpoint?.tag || "IN-TRANSIT";
    const mappedStatus = mapBigshipStatus(rawStatus);
    const estimatedDelivery = data.date_expected_delivery?.trim() || data.date_promised_delivery?.trim() || null;

    const result = {
      success: true,
      orderId: data.CustomGlobalOrderId || orderId || null,
      trackingNumber: data.tracking_number || awb,
      carrier: data.courier_name || "Bigship Express",
      courierImage: data.courier_image || null,
      rawStatus,
      mappedStatus,
      latestCheckpointTime: data.latest_checkpoint_time || latestCheckpoint?.checkpoint_time,
      estimatedDelivery,
      promisedDelivery: data.date_promised_delivery || null,
      lastScan: data.last_scan || null,
      currentLocation: latestCheckpoint?.location || null,
      latestMessage: latestCheckpoint?.message || data.order_status,
      checkpoints,
      directTrackingUrl: "https://app.bigship.direct/shipment-tracking",
    };

    // Optionally sync to Supabase database deliveries table
    if (syncToDb && orderId) {
      const timelineEntries = checkpoints.map((cp: any) => ({
        status: mapBigshipStatus(cp.tag || cp.order_status),
        timestamp: cp.checkpoint_time,
        location: cp.location,
        message: cp.message,
      }));

      const updateData: any = {
        carrier: result.carrier,
        status: result.mappedStatus,
        timeline: timelineEntries,
      };
      if (result.estimatedDelivery) {
        updateData.estimated_delivery = result.estimatedDelivery;
      }

      await supabase.from("deliveries").update(updateData).eq("order_id", orderId);

      if (result.mappedStatus === "delivered") {
        await supabase.from("orders").update({ status: "delivered" }).eq("id", orderId);
      } else if (["shipped", "out_for_delivery"].includes(result.mappedStatus)) {
        const { data: o } = await supabase.from("orders").select("status").eq("id", orderId).maybeSingle();
        if (o && ["placed", "confirmed", "packed"].includes(o.status)) {
          await supabase.from("orders").update({ status: "shipped" }).eq("id", orderId);
        }
      }
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error?.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

