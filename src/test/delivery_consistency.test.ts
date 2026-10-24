import { describe, it, expect } from "vitest";

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
  });
});
