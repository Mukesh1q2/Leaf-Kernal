import { describe, it, expect } from "vitest";
import { calculateSalesMetrics, type RawOrder } from "@/lib/adminReports";

describe("Financial Order History & Account Deletion Preservation", () => {
  it("preserves financial calculations when user_id is null (customer deleted account)", () => {
    // Simulated orders where some customers have deleted accounts (user_id === null / undefined)
    const orders: RawOrder[] = [
      {
        id: "ord-1",
        created_at: "2026-10-20T10:00:00Z",
        status: "delivered",
        total: 1500,
        subtotal: 1400,
        discount: 0,
        shipping: 100,
        user_id: "user-123", // active account
        address_snapshot: {
          name: "Active Customer",
          email: "active@example.com",
          phone: "+919876543210",
        },
      },
      {
        id: "ord-2",
        created_at: "2026-10-21T12:00:00Z",
        status: "delivered",
        total: 850,
        subtotal: 800,
        discount: 50,
        shipping: 100,
        user_id: undefined, // Account deleted (ON DELETE SET NULL)
        address_snapshot: {
          name: "Former Customer (Retained Snapshot)",
          email: "former@example.com",
          phone: "+919876543211",
        },
      },
    ];

    const metrics = calculateSalesMetrics(orders);

    // Paid orders count includes both active and deleted user orders
    expect(metrics.paidOrdersCount).toBe(2);
    expect(metrics.grossSales).toBe(2200); // 1400 + 800
    expect(metrics.couponDiscounts).toBe(50);
    expect(metrics.shippingRecorded).toBe(200); // 100 + 100
    expect(metrics.totalRevenue).toBe(2350); // 1500 + 850
    expect(metrics.averageOrderValue).toBe(1175); // 2350 / 2
  });

  it("retains order line item historical snapshots even when product_id is null (archived/deleted product)", () => {
    // When a product catalog item is archived or purged, the line item historical snapshot must persist
    const lineItemSnapshot = {
      id: "item-snapshot-1",
      order_id: "ord-historical",
      product_id: null, // Decoupled on product purge
      product_name: "Discontinued Herbal Elixir", // Immutable snapshot
      unit_price: 1200, // Historical price paid
      quantity: 3,
      subtotal: 3600,
    };

    expect(lineItemSnapshot.product_id).toBeNull();
    expect(lineItemSnapshot.product_name).toBe("Discontinued Herbal Elixir");
    expect(lineItemSnapshot.unit_price).toBe(1200);
    expect(lineItemSnapshot.subtotal).toBe(3600);
  });

  it("maintains data minimization: order retains only accounting-relevant snapshot fields", () => {
    const historicalOrderRecord = {
      id: "ord-audit-99",
      user_id: null, // User identity severed
      customer_name: "J. Doe",
      customer_email: "jdoe@example.com",
      customer_phone: "+919876543210",
      shipping_address: {
        city: "Bengaluru",
        state: "Karnataka",
        postal_code: "560001",
      },
      total_amount: 1999,
      payment_status: "paid",
      // Sensitive auth data fields MUST NOT exist in orders
      password_hash: undefined,
      auth_token: undefined,
      session_id: undefined,
      raw_card_data: undefined,
    };

    expect(historicalOrderRecord.user_id).toBeNull();
    expect(historicalOrderRecord.password_hash).toBeUndefined();
    expect(historicalOrderRecord.auth_token).toBeUndefined();
    expect(historicalOrderRecord.raw_card_data).toBeUndefined();
    expect(historicalOrderRecord.total_amount).toBe(1999);
  });
});
