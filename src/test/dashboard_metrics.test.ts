import { describe, it, expect } from "vitest";
import {
  isOrderPaid,
  getPeriodDateBoundaries,
  calculateDashboardMetricsFromRawData,
  getAttentionItems,
  canRoleViewFinancials,
  canRoleViewCustomerContact,
} from "../lib/dashboardMetrics";

describe("Admin Dashboard Metrics & Role-Access Engine", () => {
  describe("Priority 1: Data Correctness & Trustworthy Numbers", () => {
    it("distinguishes captured/paid orders from pending, failed, or cancelled orders", () => {
      expect(isOrderPaid({ status: "confirmed", stripe_session_id: "pay_12345" })).toBe(true);
      expect(isOrderPaid({ status: "shipped", stripe_session_id: "pay_12345" })).toBe(true);
      expect(isOrderPaid({ status: "delivered", stripe_session_id: "pay_12345" })).toBe(true);

      // Pending (unpaid / abandoned checkout)
      expect(isOrderPaid({ status: "pending", stripe_session_id: null })).toBe(false);
      expect(isOrderPaid({ status: "pending", stripe_session_id: "" })).toBe(false);

      // Cancelled (failed or refunded)
      expect(isOrderPaid({ status: "cancelled", stripe_session_id: "pay_12345" })).toBe(false);
      expect(isOrderPaid({ status: "cancelled", stripe_session_id: null })).toBe(false);
    });

    it("calculates gross and net revenue exclusively from paid orders and deducts returns", () => {
      const orders = [
        { id: "ord-1", status: "confirmed", total: 1000, stripe_session_id: "pay_1", user_id: "u1", created_at: "2026-10-26T00:00:00Z" },
        { id: "ord-2", status: "delivered", total: 2000, stripe_session_id: "pay_2", user_id: "u2", created_at: "2026-10-26T01:00:00Z" },
        { id: "ord-3", status: "pending", total: 5000, stripe_session_id: null, user_id: "u3", created_at: "2026-10-26T02:00:00Z" }, // Unpaid!
        { id: "ord-4", status: "cancelled", total: 3000, stripe_session_id: null, user_id: "u4", created_at: "2026-10-26T03:00:00Z" }, // Cancelled!
      ];

      // ord-2 has returned delivery
      const deliveries = [
        { order_id: "ord-2", status: "returned" },
      ];

      const metrics = calculateDashboardMetricsFromRawData(
        orders,
        [],
        [],
        0,
        0,
        100,
        2,
        deliveries
      );

      // Gross sales = ord-1 (1000) + ord-2 (2000) = 3000 (excludes ord-3 5000 and ord-4 3000)
      expect(metrics.grossRevenue).toBe(3000);
      expect(metrics.refunds).toBe(2000);
      expect(metrics.netRevenue).toBe(1000); // 3000 - 2000 = 1000
      expect(metrics.paidOrdersCount).toBe(2);
      expect(metrics.pendingOrdersCount).toBe(1);
      expect(metrics.cancelledOrdersCount).toBe(1);
      expect(metrics.totalOrdersCount).toBe(4);
      expect(metrics.averageOrderValue).toBe(1500); // 3000 / 2 = 1500
    });

    it("calculates top products strictly from order_items of paid orders (units sold & revenue)", () => {
      const orders = [
        { id: "ord-paid", status: "confirmed", total: 1500, stripe_session_id: "pay_1", user_id: "u1", created_at: "2026-10-26T00:00:00Z" },
        { id: "ord-unpaid", status: "pending", total: 9999, stripe_session_id: null, user_id: "u2", created_at: "2026-10-26T01:00:00Z" },
      ];

      const orderItems = [
        // From paid order
        { order_id: "ord-paid", product_id: "p1", product_name: "Ashwagandha", price: 500, quantity: 2 }, // units: 2, rev: 1000
        { order_id: "ord-paid", product_id: "p2", product_name: "Moringa Powder", price: 250, quantity: 2 }, // units: 2, rev: 500
        // From unpaid order (must NOT be counted)
        { order_id: "ord-unpaid", product_id: "p3", product_name: "Ghost Product", price: 9999, quantity: 10 },
      ];

      const metrics = calculateDashboardMetricsFromRawData(
        orders,
        orderItems,
        [],
        0,
        0,
        0,
        0,
        []
      );

      expect(metrics.topProducts.length).toBe(2);
      const ashwagandha = metrics.topProducts.find((p) => p.product_name === "Ashwagandha");
      expect(ashwagandha).toBeDefined();
      expect(ashwagandha?.units_sold).toBe(2);
      expect(ashwagandha?.revenue).toBe(1000);

      // Verify ghost product from pending order is not present
      const ghost = metrics.topProducts.find((p) => p.product_name === "Ghost Product");
      expect(ghost).toBeUndefined();
    });

    it("counts low-stock and out-of-stock products across the entire catalog", () => {
      const catalog = [
        { id: "p1", name: "In Stock Normal", stock_quantity: 50, is_active: true },
        { id: "p2", name: "In Stock High", stock_quantity: 120, is_active: true },
        { id: "p3", name: "Low Stock 1", stock_quantity: 8, is_active: true },
        { id: "p4", name: "Low Stock 2", stock_quantity: 3, is_active: true },
        { id: "p5", name: "Out of Stock 1", stock_quantity: 0, is_active: true },
        { id: "p6", name: "Out of Stock 2", stock_quantity: -1, is_active: true },
        { id: "p7", name: "Inactive Low Stock", stock_quantity: 2, is_active: false }, // Inactive excluded
      ];

      const metrics = calculateDashboardMetricsFromRawData([], [], catalog);
      expect(metrics.totalProductsCount).toBe(6); // 6 active
      expect(metrics.lowStockCount).toBe(2); // p3 (8), p4 (3)
      expect(metrics.outOfStockCount).toBe(2); // p5 (0), p6 (-1)
    });

    it("defines customer metrics precisely: ordering customers in period vs registered customers", () => {
      const orders = [
        { id: "ord-1", status: "confirmed", total: 500, stripe_session_id: "pay_1", user_id: "user-alpha", created_at: "2026-10-26T00:00:00Z" },
        { id: "ord-2", status: "delivered", total: 600, stripe_session_id: "pay_2", user_id: "user-alpha", created_at: "2026-10-26T01:00:00Z" }, // repeat user
        { id: "ord-3", status: "confirmed", total: 700, stripe_session_id: "pay_3", user_id: "user-beta", created_at: "2026-10-26T02:00:00Z" },
      ];

      const metrics = calculateDashboardMetricsFromRawData(
        orders,
        [],
        [],
        0,
        0,
        250 // 250 registered customers
      );

      // 2 unique customers placed paid orders in this period
      expect(metrics.periodOrderingCustomersCount).toBe(2);
      expect(metrics.totalRegisteredCustomersCount).toBe(250);
    });
  });

  describe("Priority 2: Role-Tailored Access & Security Boundaries", () => {
    it("allows only admin role to view gross and net financial turnover", () => {
      expect(canRoleViewFinancials(["admin"])).toBe(true);
      expect(canRoleViewFinancials(["inventory_manager"])).toBe(false);
      expect(canRoleViewFinancials(["customer_support"])).toBe(false);
      expect(canRoleViewFinancials(["content_manager", "editor"])).toBe(false);
      expect(canRoleViewFinancials(["moderator"])).toBe(false);
    });

    it("allows only admin and customer support to view customer contact info", () => {
      expect(canRoleViewCustomerContact(["admin"])).toBe(true);
      expect(canRoleViewCustomerContact(["customer_support"])).toBe(true);
      expect(canRoleViewCustomerContact(["inventory_manager"])).toBe(false);
      expect(canRoleViewCustomerContact(["content_manager"])).toBe(false);
    });
  });

  describe("Priority 3: Daily Operations & Attention Triage", () => {
    it("generates role-filtered attention items for urgent operational triage", () => {
      const mockMetrics = {
        grossRevenue: 5000,
        netRevenue: 5000,
        refunds: 0,
        paidOrdersCount: 5,
        pendingOrdersCount: 2,
        cancelledOrdersCount: 0,
        returnedOrdersCount: 0,
        totalOrdersCount: 7,
        averageOrderValue: 1000,
        periodOrderingCustomersCount: 4,
        totalRegisteredCustomersCount: 100,
        totalProductsCount: 20,
        lowStockCount: 4,
        outOfStockCount: 2,
        pendingReviewsCount: 3,
        unreadInquiriesCount: 5,
        overdueFulfillmentCount: 2,
        activeCouponsCount: 1,
        dailyRevenue: [],
        topProducts: [],
        ordersByStatus: [],
      };

      // Admin sees all attention items
      const adminItems = getAttentionItems(mockMetrics, ["admin"]);
      expect(adminItems.some((i) => i.id === "out-of-stock")).toBe(true);
      expect(adminItems.some((i) => i.id === "low-stock")).toBe(true);
      expect(adminItems.some((i) => i.id === "overdue-fulfillment")).toBe(true);
      expect(adminItems.some((i) => i.id === "pending-reviews")).toBe(true);
      expect(adminItems.some((i) => i.id === "unread-inquiries")).toBe(true);

      // Inventory Manager sees only stock and fulfillment items
      const inventoryItems = getAttentionItems(mockMetrics, ["inventory_manager"]);
      expect(inventoryItems.some((i) => i.id === "out-of-stock")).toBe(true);
      expect(inventoryItems.some((i) => i.id === "low-stock")).toBe(true);
      expect(inventoryItems.some((i) => i.id === "overdue-fulfillment")).toBe(true);
      expect(inventoryItems.some((i) => i.id === "pending-reviews")).toBe(false);
      expect(inventoryItems.some((i) => i.id === "unread-inquiries")).toBe(false);

      // Customer Support sees fulfillment and inquiries
      const supportItems = getAttentionItems(mockMetrics, ["customer_support"]);
      expect(supportItems.some((i) => i.id === "overdue-fulfillment")).toBe(true);
      expect(supportItems.some((i) => i.id === "unread-inquiries")).toBe(true);
      expect(supportItems.some((i) => i.id === "out-of-stock")).toBe(false);

      // Content Manager sees pending reviews
      const contentItems = getAttentionItems(mockMetrics, ["content_manager"]);
      expect(contentItems.some((i) => i.id === "pending-reviews")).toBe(true);
      expect(contentItems.some((i) => i.id === "out-of-stock")).toBe(false);
    });

    it("calculates exact calendar period boundaries in India Standard Time (IST)", () => {
      // 2026-10-26 12:00:00 UTC = 17:30:00 IST on 2026-10-26
      const mockNow = new Date("2026-10-26T12:00:00.000Z");

      const today = getPeriodDateBoundaries("today", mockNow);
      expect(today.startDate).toBe("2026-10-25T18:30:00.000Z"); // 00:00:00 IST on Oct 26
      expect(today.endDate).toBe("2026-10-26T18:29:59.999Z"); // 23:59:59 IST on Oct 26

      const yesterday = getPeriodDateBoundaries("yesterday", mockNow);
      expect(yesterday.startDate).toBe("2026-10-24T18:30:00.000Z"); // 00:00:00 IST on Oct 25
      expect(yesterday.endDate).toBe("2026-10-25T18:29:59.999Z"); // 23:59:59 IST on Oct 25

      const all = getPeriodDateBoundaries("all", mockNow);
      expect(all.startDate).toBeNull();
      expect(all.endDate).toBeNull();
    });
  });
});
