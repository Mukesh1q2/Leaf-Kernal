import { describe, it, expect } from "vitest";
import crypto from "node:crypto";

// Test HMAC-SHA256 verification logic used in the Razorpay Webhook edge function & dev middleware
function verifyRazorpayWebhookSignature(payload: string, signature: string, secret: string): boolean {
  if (!payload || !signature || !secret) return false;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return expectedSignature.toLowerCase() === signature.toLowerCase();
}

// Test referral code formatting and self-referral prevention logic
function validateReferralCode(code: string | null | undefined, currentUserId?: string, referrerUserId?: string) {
  if (!code || typeof code !== "string" || !code.trim()) {
    return { valid: false, error: "Referral code is empty" };
  }
  const cleanCode = code.trim().toUpperCase();
  if (cleanCode.length < 4 || cleanCode.length > 20) {
    return { valid: false, error: "Referral code has invalid length" };
  }
  if (currentUserId && referrerUserId && currentUserId === referrerUserId) {
    return { valid: false, error: "Cannot use your own referral code" };
  }
  return { valid: true, code: cleanCode };
}

// Test delivery notification text formatting
function getDeliveryNotificationDetails(status: string, orderId: string, carrier?: string, trackingId?: string) {
  const shortId = orderId.slice(0, 8);
  switch (status) {
    case "packed":
      return {
        title: "📦 Order Packed",
        message: `Your order #${shortId} is packed and awaiting courier dispatch.`,
        syncedOrderStatus: "confirmed",
      };
    case "shipped":
      return {
        title: "🚚 Order Shipped",
        message: `Your order #${shortId} is in transit via ${carrier || "courier"}${trackingId ? ` (Tracking: ${trackingId})` : ""}.`,
        syncedOrderStatus: "shipped",
      };
    case "out_for_delivery":
      return {
        title: "🛵 Out for Delivery",
        message: `Your order #${shortId} is out for delivery today!`,
        syncedOrderStatus: "shipped",
      };
    case "delivered":
      return {
        title: "✅ Order Delivered",
        message: `Your order #${shortId} has been delivered. Thank you for choosing Leaf & Kernel!`,
        syncedOrderStatus: "delivered",
      };
    case "returned":
      return {
        title: "↩️ Order Returned",
        message: `Your order #${shortId} has been marked as returned.`,
        syncedOrderStatus: "returned",
      };
    default:
      return {
        title: "📋 Delivery Status Update",
        message: `Status updated to ${status}.`,
        syncedOrderStatus: status,
      };
  }
}

describe("Razorpay Webhook & Signature Verification", () => {
  const secret = "lk_rzp_live_whsec_2026";
  const samplePayload = JSON.stringify({
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: "pay_test123",
          amount: 99900,
          currency: "INR",
          status: "captured",
          notes: {
            order_id: "e10a26b2-6581-424a-9ad9-90bc02d5a3ef",
          },
        },
      },
    },
  });

  it("verifies valid HMAC-SHA256 signature correctly", () => {
    const validSignature = crypto
      .createHmac("sha256", secret)
      .update(samplePayload)
      .digest("hex");

    expect(verifyRazorpayWebhookSignature(samplePayload, validSignature, secret)).toBe(true);
  });

  it("rejects tampered webhook payloads", () => {
    const validSignature = crypto
      .createHmac("sha256", secret)
      .update(samplePayload)
      .digest("hex");

    const tamperedPayload = samplePayload.replace("99900", "10000");
    expect(verifyRazorpayWebhookSignature(tamperedPayload, validSignature, secret)).toBe(false);
  });

  it("rejects webhook signatures computed with the wrong secret", () => {
    const forgedSignature = crypto
      .createHmac("sha256", "wrong_secret_123")
      .update(samplePayload)
      .digest("hex");

    expect(verifyRazorpayWebhookSignature(samplePayload, forgedSignature, secret)).toBe(false);
  });

  it("safely handles empty signatures or empty payloads", () => {
    expect(verifyRazorpayWebhookSignature("", "sig", secret)).toBe(false);
    expect(verifyRazorpayWebhookSignature(samplePayload, "", secret)).toBe(false);
    expect(verifyRazorpayWebhookSignature(samplePayload, "sig", "")).toBe(false);
  });
});

describe("Referral System Claim & Validation Logic", () => {
  it("formats and normalizes valid referral codes", () => {
    const result = validateReferralCode("  lkabcd12  ");
    expect(result.valid).toBe(true);
    expect(result.code).toBe("LKABCD12");
  });

  it("rejects empty or whitespace referral codes", () => {
    expect(validateReferralCode("   ").valid).toBe(false);
    expect(validateReferralCode(null).valid).toBe(false);
  });

  it("blocks self-referral when referrer user ID matches current user ID", () => {
    const userId = "usr_1111-2222-3333";
    const result = validateReferralCode("LKTEST", userId, userId);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Cannot use your own referral code");
  });

  it("allows referral when referrer user ID differs from current user ID", () => {
    const currentUserId = "usr_1111-2222-3333";
    const referrerId = "usr_9999-8888-7777";
    const result = validateReferralCode("LKTEST", currentUserId, referrerId);
    expect(result.valid).toBe(true);
  });
});

describe("Delivery Notifications and Status Synchronization", () => {
  const orderId = "b9090c88-e2eb-45ae-9ea6-f77e2316e3eb";

  it("generates correct message and synced status for packed order", () => {
    const notif = getDeliveryNotificationDetails("packed", orderId);
    expect(notif.title).toContain("Order Packed");
    expect(notif.message).toContain("packed and awaiting courier dispatch");
  });

  it("generates carrier and tracking info when shipped", () => {
    const notif = getDeliveryNotificationDetails("shipped", orderId, "BlueDart", "BD12345678");
    expect(notif.title).toContain("Order Shipped");
    expect(notif.message).toContain("BlueDart");
    expect(notif.message).toContain("Tracking: BD12345678");
    expect(notif.syncedOrderStatus).toBe("shipped");
  });

  it("generates out for delivery notification", () => {
    const notif = getDeliveryNotificationDetails("out_for_delivery", orderId);
    expect(notif.title).toContain("Out for Delivery");
    expect(notif.message).toContain("out for delivery today");
  });

  it("generates delivered notification and syncs order to delivered", () => {
    const notif = getDeliveryNotificationDetails("delivered", orderId);
    expect(notif.title).toContain("Order Delivered");
    expect(notif.syncedOrderStatus).toBe("delivered");
  });
});
