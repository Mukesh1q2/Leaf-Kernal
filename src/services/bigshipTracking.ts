import { supabase } from "@/integrations/supabase/client";

export type DeliveryStage =
  | "placed"
  | "packed"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "returned";

export interface BigshipCheckpoint {
  location: string | null;
  tag: string;
  order_status: string;
  checkpoint_time: string;
  message: string;
}

export interface BigshipTrackingData {
  CustomGlobalOrderId?: string;
  order_place_time?: string;
  tracking_number: string;
  courier_name?: string;
  courier_image?: string;
  tag?: string;
  order_status?: string;
  latest_checkpoint_time?: string;
  date_expected_delivery?: string;
  date_promised_delivery?: string;
  last_scan?: string;
  checkpoints?: BigshipCheckpoint[];
}

export interface BigshipTrackingResult {
  success: boolean;
  orderId?: string;
  trackingNumber?: string;
  carrier?: string;
  courierImage?: string;
  rawStatus?: string;
  mappedStatus?: DeliveryStage;
  latestCheckpointTime?: string;
  estimatedDelivery?: string | null;
  promisedDelivery?: string | null;
  lastScan?: string;
  currentLocation?: string;
  latestMessage?: string;
  checkpoints: BigshipCheckpoint[];
  directTrackingUrl: string;
  error?: string;
}

const BIGSHIP_PUBLIC_TRACKING_URL =
  import.meta.env.VITE_BIGSHIP_TRACKING_API_URL ||
  "https://tracking.bigship.direct/api/show-tracking";

/**
 * Maps Bigship courier statuses / tags to Leaf & Kernel standard delivery lifecycle stages
 */
export function mapBigshipStatus(statusOrTag?: string | null): DeliveryStage {
  if (!statusOrTag) return "placed";
  const s = statusOrTag.toLowerCase().trim();

  // Returned / RTO checks first
  if (s.includes("rto") || s.includes("undelivered") || s.includes("lost") || s.includes("return")) {
    return "returned";
  }

  // Delivered
  if (s.includes("delivered")) {
    return "delivered";
  }

  // Out for delivery
  if (s.includes("out for delivery") || s.includes("out_for_delivery") || s.includes("out for pickup")) {
    return "out_for_delivery";
  }

  // In Transit / Shipped
  if (s.includes("in-transit") || s.includes("in transit") || s.includes("intransit") || s.includes("shipped") || s.includes("hub") || s.includes("picked")) {
    return "shipped";
  }

  // Packed / Pickup Scheduled / Manifested
  if (s.includes("pickup") || s.includes("manifest") || s.includes("packed") || s.includes("ready")) {
    return "packed";
  }

  return "placed";
}

/**
 * Fetches live shipment tracking info from Bigship
 */
export async function fetchBigshipTracking(
  trackingId: string,
  segment: "domestic" | "hyperlocal" | "international" = "domestic",
  type: "awb" | "lr" = "awb"
): Promise<BigshipTrackingResult> {
  const cleanAwb = (trackingId || "").trim();
  const directTrackingUrl = `https://app.bigship.direct/shipment-tracking`;

  if (!cleanAwb) {
    return {
      success: false,
      error: "Tracking ID / AWB cannot be empty.",
      checkpoints: [],
      directTrackingUrl,
    };
  }

  const queryUrl = `${BIGSHIP_PUBLIC_TRACKING_URL}?track_segment=${segment}&track_type=${type}&track_value=${encodeURIComponent(cleanAwb)}`;

  try {
    const res = await fetch(queryUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (res.status === 404) {
      return {
        success: false,
        error: `Shipment #${cleanAwb} is being processed or was not found in Bigship system yet.`,
        checkpoints: [],
        directTrackingUrl,
      };
    }

    if (!res.ok) {
      return {
        success: false,
        error: `Tracking service responded with status ${res.status}.`,
        checkpoints: [],
        directTrackingUrl,
      };
    }

    const payload = await res.json();
    const data: BigshipTrackingData | undefined = payload?.data;

    if (!data || (!data.tracking_number && !data.CustomGlobalOrderId)) {
      return {
        success: false,
        error: payload?.message || "No tracking details available for this shipment.",
        checkpoints: [],
        directTrackingUrl,
      };
    }

    const checkpoints = Array.isArray(data.checkpoints) ? [...data.checkpoints] : [];
    // Sort checkpoints descending by timestamp (newest first)
    checkpoints.sort((a, b) => {
      const timeA = new Date(a.checkpoint_time).getTime() || 0;
      const timeB = new Date(b.checkpoint_time).getTime() || 0;
      return timeB - timeA;
    });

    const latestCheckpoint = checkpoints[0];
    const rawStatus = data.tag || data.order_status || latestCheckpoint?.tag || "IN-TRANSIT";
    const mappedStatus = mapBigshipStatus(rawStatus);

    const estimatedDelivery =
      data.date_expected_delivery?.trim() ||
      data.date_promised_delivery?.trim() ||
      null;

    return {
      success: true,
      orderId: data.CustomGlobalOrderId,
      trackingNumber: data.tracking_number || cleanAwb,
      carrier: data.courier_name || "Bigship Express",
      courierImage: data.courier_image,
      rawStatus,
      mappedStatus,
      latestCheckpointTime: data.latest_checkpoint_time || latestCheckpoint?.checkpoint_time,
      estimatedDelivery,
      promisedDelivery: data.date_promised_delivery || null,
      lastScan: data.last_scan,
      currentLocation: latestCheckpoint?.location || undefined,
      latestMessage: latestCheckpoint?.message || data.order_status,
      checkpoints,
      directTrackingUrl,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to connect to Bigship tracking service.",
      checkpoints: [],
      directTrackingUrl,
    };
  }
}

/**
 * Synchronizes Bigship live status into Supabase public.deliveries table
 */
export async function syncBigshipToDelivery(
  orderId: string,
  trackingId?: string
): Promise<{ success: boolean; data?: BigshipTrackingResult; error?: string }> {
  try {
    let awb = trackingId;
    let existingDelivery: any = null;

    if (!awb) {
      const { data: d, error } = await (supabase.from("deliveries" as any) as any)
        .select("*")
        .eq("order_id", orderId)
        .maybeSingle();

      if (error || !d) {
        return { success: false, error: "Delivery record not found for this order." };
      }
      existingDelivery = d;
      awb = d.tracking_id;
    }

    if (!awb) {
      return { success: false, error: "Order does not have a tracking ID / AWB assigned." };
    }

    const result = await fetchBigshipTracking(awb);
    if (!result.success) {
      return { success: false, error: result.error, data: result };
    }

    // Format timeline checkpoints into deliveries table structure
    const updatedTimeline = result.checkpoints.map((cp) => ({
      status: mapBigshipStatus(cp.tag || cp.order_status),
      timestamp: cp.checkpoint_time,
      location: cp.location,
      message: cp.message,
    }));

    const updatePayload: any = {
      carrier: result.carrier || "Bigship Direct",
      status: result.mappedStatus || "shipped",
      timeline: updatedTimeline,
    };

    if (result.estimatedDelivery) {
      updatePayload.estimated_delivery = result.estimatedDelivery;
    }

    const { error: updateError } = await (supabase.from("deliveries" as any) as any)
      .update(updatePayload)
      .eq("order_id", orderId);

    if (updateError) {
      return { success: false, error: updateError.message, data: result };
    }

    // Keep order status synchronized if delivered or shipped
    if (result.mappedStatus === "delivered") {
      await supabase.from("orders").update({ status: "delivered" }).eq("id", orderId);
    } else if (result.mappedStatus === "shipped" || result.mappedStatus === "out_for_delivery") {
      const { data: orderData } = await supabase.from("orders").select("status").eq("id", orderId).maybeSingle();
      if (orderData && ["placed", "confirmed", "packed"].includes(orderData.status)) {
        await supabase.from("orders").update({ status: "shipped" }).eq("id", orderId);
      }
    }

    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err?.message || "Sync failed." };
  }
}

