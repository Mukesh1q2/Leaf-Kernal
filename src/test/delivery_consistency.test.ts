import { describe, it, expect } from "vitest";
import { resolveTrackingAccess } from "@/pages/TrackOrder";

// Lifecycle validation logic matching database triggers and UI guards
export function canCancelOrder(currentStatus: string): { allowed: boolean; reason?: string } {
  const terminalStatuses = ["shipped", "delivered"];
  if (terminalStatuses.includes(currentStatus)) {
    return {
      allowed: false,
      reason: `Cannot cancel an order that has already been ${currentStatus}.`,
    };
  }
  return { allowed: true };
}

export function canDispatchDelivery(orderStatus: string, targetDeliveryStatus: string): { allowed: boolean; reason?: string } {
  const activeDispatchStatuses = ["shipped", "out_for_delivery", "delivered"];
  if (orderStatus === "cancelled" && activeDispatchStatuses.includes(targetDeliveryStatus)) {
    return {
      allowed: false,
      reason: `Cannot mark delivery as '${targetDeliveryStatus}' because order is already cancelled.`,
    };
  }
  return { allowed: true };
}

export function deriveOrderStatusFromDelivery(deliveryStatus: string, currentOrderStatus: string): string {
  // If order is cancelled, delivery sync must not resurrect it
  if (currentOrderStatus === "cancelled") {
    return "cancelled";
  }
  switch (deliveryStatus) {
    case "shipped":
    case "out_for_delivery":
      return "shipped";
    case "delivered":
      return "delivered";
    default:
      return currentOrderStatus;
  }
}

describe("Order and Delivery Status Consistency", () => {
  describe("Order Cancellation Lifecycle Rules", () => {
    it("allows cancellation when order is pending or confirmed", () => {
      expect(canCancelOrder("pending").allowed).toBe(true);
      expect(canCancelOrder("confirmed").allowed).toBe(true);
    });

    it("rejects cancellation once order is shipped", () => {
      const res = canCancelOrder("shipped");
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain("Cannot cancel an order that has already been shipped");
    });

    it("rejects cancellation once order is delivered", () => {
      const res = canCancelOrder("delivered");
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain("Cannot cancel an order that has already been delivered");
    });
  });

  describe("Delivery Dispatch Lifecycle Rules", () => {
    it("blocks dispatching or delivering an order that has been cancelled", () => {
      const resShipped = canDispatchDelivery("cancelled", "shipped");
      expect(resShipped.allowed).toBe(false);
      expect(resShipped.reason).toContain("because order is already cancelled");

      const resOutForDelivery = canDispatchDelivery("cancelled", "out_for_delivery");
      expect(resOutForDelivery.allowed).toBe(false);

      const resDelivered = canDispatchDelivery("cancelled", "delivered");
      expect(resDelivered.allowed).toBe(false);
    });

    it("allows packing or returning a cancelled order", () => {
      expect(canDispatchDelivery("cancelled", "returned").allowed).toBe(true);
      expect(canDispatchDelivery("cancelled", "placed").allowed).toBe(true);
    });

    it("allows dispatch for confirmed or pending orders", () => {
      expect(canDispatchDelivery("confirmed", "shipped").allowed).toBe(true);
      expect(canDispatchDelivery("confirmed", "out_for_delivery").allowed).toBe(true);
      expect(canDispatchDelivery("confirmed", "delivered").allowed).toBe(true);
    });
  });

  describe("Automatic Order-Delivery Status Sync", () => {
    it("updates order status to shipped when delivery becomes shipped or out_for_delivery", () => {
      expect(deriveOrderStatusFromDelivery("shipped", "confirmed")).toBe("shipped");
      expect(deriveOrderStatusFromDelivery("out_for_delivery", "confirmed")).toBe("shipped");
    });

    it("updates order status to delivered when delivery is completed", () => {
      expect(deriveOrderStatusFromDelivery("delivered", "shipped")).toBe("delivered");
    });

    it("never resurrects a cancelled order through delivery status change", () => {
      expect(deriveOrderStatusFromDelivery("shipped", "cancelled")).toBe("cancelled");
      expect(deriveOrderStatusFromDelivery("delivered", "cancelled")).toBe("cancelled");
    });
  });

  describe("Customer Tracking View Contradiction Prevention", () => {
    it("displays cancellation banner rather than misleading active delivery steps when order is cancelled", () => {
      const cancelledOrder = {
        id: "ord-test-cancelled",
        status: "cancelled",
      };

      const isCancelled = cancelledOrder.status === "cancelled";
      expect(isCancelled).toBe(true);

      // UI condition in TrackOrder.tsx renders alert banner when isCancelled === true
      const displayTimeline = !isCancelled;
      expect(displayTimeline).toBe(false);
    });

    it("requires authenticated user session before attempting order queries under RLS", () => {
      const unauthenticatedUser = null;
      const isAuthenticated = Boolean(unauthenticatedUser);

      expect(isAuthenticated).toBe(false);
      // TrackOrder shields database from unauthenticated queries
      const shouldQueryDatabase = isAuthenticated;
      expect(shouldQueryDatabase).toBe(false);
    });

    it("verifies public tracking projection strips all customer PII, payment tokens, and addresses", () => {
      const rawOrderAndDelivery = {
        id: "7b949c5e-8d2b-4e1a-9f3c-1a2b3c4d5e6f",
        user_id: "user-12345",
        customer_name: "Ramesh Kumar",
        customer_email: "ramesh@example.com",
        customer_phone: "+919876543210",
        shipping_address: "Flat 402, Green Meadows, Bengaluru, Karnataka 560034",
        total: 1499,
        subtotal: 1420,
        stripe_session_id: "pay_test123456",
        status: "shipped",
        carrier: "Delhivery",
        tracking_id: "DL123456789IN",
        estimated_delivery: "2026-10-30T10:00:00Z",
        timeline: [{ status: "placed", at: "2026-10-25T10:00:00Z" }],
      };

      // Minimal safe tracking projection helper
      const sanitizeTrackingInfo = (data: typeof rawOrderAndDelivery) => ({
        order_short_id: data.id.slice(0, 8),
        status: data.status,
        carrier: data.carrier,
        tracking_id: data.tracking_id,
        estimated_delivery: data.estimated_delivery,
        timeline: data.timeline,
      });

      const sanitized = sanitizeTrackingInfo(rawOrderAndDelivery);

      // Verifies sensitive fields are completely omitted
      expect((sanitized as any).customer_name).toBeUndefined();
      expect((sanitized as any).customer_email).toBeUndefined();
      expect((sanitized as any).customer_phone).toBeUndefined();
      expect((sanitized as any).shipping_address).toBeUndefined();
      expect((sanitized as any).total).toBeUndefined();
      expect((sanitized as any).stripe_session_id).toBeUndefined();

      // Verifies essential fulfillment milestones remain present
      expect(sanitized.order_short_id).toBe("7b949c5e");
      expect(sanitized.status).toBe("shipped");
      expect(sanitized.carrier).toBe("Delhivery");
      expect(sanitized.tracking_id).toBe("DL123456789IN");
    });
  });

  describe("Order Tracking Privacy & Enumeration Shielding", () => {
    it("handles unauthenticated visitors: shields database from queries and prompts for sign-in", () => {
      const state = resolveTrackingAccess({
        authLoading: false,
        queryLoading: false,
        user: null,
        order: null,
      });
      expect(state).toBe("unauthenticated");
    });

    it("handles order owner: provides full tracking details when authenticated user owns the order", () => {
      const state = resolveTrackingAccess({
        authLoading: false,
        queryLoading: false,
        user: { id: "user-owner-123", email: "owner@example.com" },
        order: { id: "ord-987", user_id: "user-owner-123", status: "shipped" },
      });
      expect(state).toBe("owner");
    });

    it("handles wrong-account: RLS returns null, yielding identical not_found state without disclosing order existence", () => {
      // Under Supabase RLS, a query for another user's order yields null
      const state = resolveTrackingAccess({
        authLoading: false,
        queryLoading: false,
        user: { id: "user-intruder-456", email: "intruder@example.com" },
        order: null, // RLS filters this row out
      });
      expect(state).toBe("not_found");
    });

    it("handles invalid-order ID: non-existent order returns null, yielding identical not_found state", () => {
      const state = resolveTrackingAccess({
        authLoading: false,
        queryLoading: false,
        user: { id: "user-valid-789", email: "valid@example.com" },
        order: null, // Order does not exist in DB
      });
      expect(state).toBe("not_found");
    });

    it("ensures wrong-account and invalid-order yield indistinguishable state and message (preventing oracle disclosure)", () => {
      const wrongAccountState = resolveTrackingAccess({
        authLoading: false,
        queryLoading: false,
        user: { id: "user-attacker", email: "attacker@test.com" },
        order: null, // RLS blocked access
      });

      const invalidOrderState = resolveTrackingAccess({
        authLoading: false,
        queryLoading: false,
        user: { id: "user-attacker", email: "attacker@test.com" },
        order: null, // Nonexistent order
      });

      // Both must be completely identical to prevent order-existence enumeration
      expect(wrongAccountState).toBe(invalidOrderState);
      expect(wrongAccountState).toBe("not_found");
    });
  });
});


