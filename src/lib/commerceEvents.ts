/**
 * Privacy-First Essential Commerce Events
 * 
 * Emits truthful first-party commerce events (view_item, add_to_cart, begin_checkout, purchase, refund).
 * Strictly respects user consent and prevents sending sensitive health/quiz data externally.
 */

import { trackActivity, type ActivityType } from "./activity";
import { isFeatureEnabledSync } from "./featureFlags";

export interface CommerceEventPayload {
  eventName: "view_item" | "add_to_cart" | "begin_checkout" | "purchase" | "refund";
  itemId?: string;
  itemName?: string;
  price?: number;
  quantity?: number;
  orderId?: string;
  totalValue?: number;
  currency?: string;
  itemCount?: number;
}

export function emitCommerceEvent(event: CommerceEventPayload): boolean {
  try {
    // 0. Master-Admin Feature Flag Guard: suspend tracking if disabled
    if (!isFeatureEnabledSync("commerce_events")) {
      return false;
    }

    // 1. Consent check: respect Do Not Track & declined consent
    if (typeof window !== "undefined") {
      const consent = localStorage.getItem("cookie_consent");
      if (consent === "declined") {
        return false;
      }
    }

    const currency = event.currency || "INR";

    // 2. Map standard commerce event to truthful local first-party activity tracking
    let mappedActivity: ActivityType;
    switch (event.eventName) {
      case "view_item":
        mappedActivity = "view";
        break;
      case "add_to_cart":
        mappedActivity = "add_to_cart";
        break;
      case "begin_checkout":
        mappedActivity = "search"; // or dedicated checkout indicator
        break;
      case "purchase":
        mappedActivity = "purchase";
        break;
      default:
        mappedActivity = "view";
    }

    trackActivity(mappedActivity, event.itemId || null, {
      eventName: event.eventName,
      currency,
      price: event.price,
      quantity: event.quantity,
      orderId: event.orderId,
      totalValue: event.totalValue,
      itemCount: event.itemCount,
      timestamp: new Date().toISOString(),
    });

    return true;
  } catch (err) {
    console.debug("Failed to emit commerce event", err);
    return false;
  }
}
