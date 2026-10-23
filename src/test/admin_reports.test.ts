import { describe, it, expect } from "vitest";
import {
  calculateSalesMetrics,
  calculateProductPerformance,
  filterOrdersByDateRange,
  formatKolkataDate,
  sanitizeCsvCell,
  generateSafeCsv,
  type RawOrder,
  type RawOrderItem,
} from "../lib/adminReports";

describe("Admin Reports Engine & Security", () => {
  const sampleOrders: RawOrder[] = [
    {
      id: "ord-1",
      status: "confirmed",
      subtotal: 1000,
      discount: 100,
      loyalty_discount: 50,
      shipping: 50,
      total: 900,
      created_at: "2026-10-20T10:00:00Z",
    },
    {
      id: "ord-2",
      status: "delivered",
      subtotal: 2000,
      discount: 0,
      loyalty_discount: 0,
      shipping: 0,
      total: 2000,
      created_at: "2026-10-21T12:00:00Z",
    },
    {
      id: "ord-3",
      status: "shipped",
      subtotal: 500,
      discount: 50,
      loyalty_discount: 0,
      shipping: 50,
      total: 500,
      created_at: "2026-10-22T08:00:00Z",
    },
    {
      id: "ord-4",
      status: "cancelled",
      subtotal: 1500,
      discount: 200,
      loyalty_discount: 0,
      shipping: 50,
      total: 1350,
      created_at: "2026-10-22T09:00:00Z",
    },
    {
      id: "ord-5",
      status: "pending",
      subtotal: 800,
      discount: 0,
      loyalty_discount: 0,
      shipping: 50,
      total: 850,
      created_at: "2026-10-23T14:00:00Z",
    },
  ];

  const sampleItems: RawOrderItem[] = [
    { order_id: "ord-1", product_id: "prod-ash", product_name: "Ashwagandha", price: 500, quantity: 2 },
    { order_id: "ord-2", product_id: "prod-ash", product_name: "Ashwagandha", price: 500, quantity: 2 },
    { order_id: "ord-2", product_id: "prod-mor", product_name: "Moringa", price: 1000, quantity: 1 },
    { order_id: "ord-3", product_id: "prod-tur", product_name: "Turmeric", price: 500, quantity: 1 },
    // Cancelled order item should NOT be included in product performance
    { order_id: "ord-4", product_id: "prod-mor", product_name: "Moringa", price: 1000, quantity: 1 },
  ];

  describe("calculateSalesMetrics", () => {
    it("computes accurate sales metrics only from paid orders (confirmed, shipped, delivered)", () => {
      const metrics = calculateSalesMetrics(sampleOrders);

      expect(metrics.paidOrdersCount).toBe(3);
      expect(metrics.cancelledOrdersCount).toBe(1);
      expect(metrics.pendingOrdersCount).toBe(1);
      expect(metrics.totalOrdersCount).toBe(5);

      // Paid orders: ord-1 (1000), ord-2 (2000), ord-3 (500) = 3500 gross
      expect(metrics.grossSales).toBe(3500);

      // Discounts: coupon (100 + 0 + 50 = 150) + loyalty (50 + 0 + 0 = 50) = 200 total discounts
      expect(metrics.couponDiscounts).toBe(150);
      expect(metrics.loyaltyDiscounts).toBe(50);
      expect(metrics.totalDiscounts).toBe(200);

      // Net Sales = 3500 - 200 = 3300
      expect(metrics.netSales).toBe(3300);

      // Shipping recorded: 50 + 0 + 50 = 100
      expect(metrics.shippingRecorded).toBe(100);

      // Total collected revenue: 900 + 2000 + 500 = 3400
      expect(metrics.totalRevenue).toBe(3400);

      // Average Order Value = 3400 / 3 = 1133.33
      expect(metrics.averageOrderValue).toBe(1133.33);
    });

    it("handles zero orders gracefully without division by zero", () => {
      const metrics = calculateSalesMetrics([]);
      expect(metrics.paidOrdersCount).toBe(0);
      expect(metrics.grossSales).toBe(0);
      expect(metrics.netSales).toBe(0);
      expect(metrics.averageOrderValue).toBe(0);
    });
  });

  describe("calculateProductPerformance", () => {
    it("aggregates units sold and gross revenue from paid orders only", () => {
      const performance = calculateProductPerformance(sampleOrders, sampleItems);

      expect(performance).toHaveLength(3);

      const ashwagandha = performance.find((p) => p.productId === "prod-ash");
      expect(ashwagandha).toBeDefined();
      expect(ashwagandha?.unitsSold).toBe(4); // 2 from ord-1 + 2 from ord-2
      expect(ashwagandha?.grossRevenue).toBe(2000);

      const moringa = performance.find((p) => p.productId === "prod-mor");
      expect(moringa).toBeDefined();
      expect(moringa?.unitsSold).toBe(1); // ord-2 only; ord-4 cancelled ignored
      expect(moringa?.grossRevenue).toBe(1000);

      const turmeric = performance.find((p) => p.productId === "prod-tur");
      expect(turmeric).toBeDefined();
      expect(turmeric?.unitsSold).toBe(1);
      expect(turmeric?.grossRevenue).toBe(500);
    });
  });

  describe("filterOrdersByDateRange", () => {
    it("filters orders strictly between start and end date", () => {
      const filtered = filterOrdersByDateRange(sampleOrders, "2026-10-21", "2026-10-22");
      expect(filtered.map((o) => o.id)).toEqual(["ord-2", "ord-3", "ord-4"]);
    });
  });

  describe("formatKolkataDate", () => {
    it("converts UTC time to Asia/Kolkata timezone with IST offset (+5:30)", () => {
      // 2026-10-20T10:00:00Z is 3:30 PM IST
      const istStr = formatKolkataDate("2026-10-20T10:00:00Z");
      expect(istStr).toContain("2026");
      expect(istStr).toContain("20");
      expect(istStr).toContain("03:30");
      expect(istStr.toUpperCase()).toContain("PM");
    });
  });

  describe("CSV Formula Injection Protection (CWE-1236)", () => {
    it("prepends dangerous formula triggers (=, +, -, @, tab, cr) with a single quote", () => {
      expect(sanitizeCsvCell("=1+1")).toBe('"\'=1+1"');
      expect(sanitizeCsvCell("+cmd|' /C calc'!'A1'")).toBe('"\'+cmd|\' /C calc\'!\'A1\'"');
      expect(sanitizeCsvCell("-50")).toBe('"\'-50"');
      expect(sanitizeCsvCell("@SUM(A1:A10)")).toBe('"\'@SUM(A1:A10)"');
      expect(sanitizeCsvCell("\tmalicious")).toBe('"\'\tmalicious"');
    });

    it("safely handles regular text and escapes internal quotes", () => {
      expect(sanitizeCsvCell('Customer "Special" Order')).toBe('"Customer ""Special"" Order"');
      expect(sanitizeCsvCell("Regular Name")).toBe('"Regular Name"');
      expect(sanitizeCsvCell(1234)).toBe('"1234"');
      expect(sanitizeCsvCell(null)).toBe('""');
    });

    it("generates a complete safe CSV structure", () => {
      const headers = ["Order ID", "Formula Attack", "Amount"];
      const rows = [
        ["ord-1", "=SUM(A1:B1)", 500],
        ["ord-2", "Normal Customer", 1000],
      ];
      const csv = generateSafeCsv(headers, rows);
      expect(csv).toContain('"\'=SUM(A1:B1)"');
      expect(csv).toContain('"Normal Customer"');
    });
  });
});
