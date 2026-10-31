import { supabase } from "@/integrations/supabase/client";
import { formatKolkataDate, PAID_STATUSES } from "./adminReports";
import { CmsRole } from "./cmsRoles";

export type DateRangePeriod = "today" | "yesterday" | "7d" | "month" | "all";

export interface DashboardMetrics {
  grossRevenue: number;
  netRevenue: number;
  refunds: number;
  paidOrdersCount: number;
  pendingOrdersCount: number;
  cancelledOrdersCount: number;
  returnedOrdersCount: number;
  totalOrdersCount: number;
  averageOrderValue: number;
  periodOrderingCustomersCount: number;
  totalRegisteredCustomersCount: number;
  totalProductsCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  pendingReviewsCount: number;
  unreadInquiriesCount: number;
  overdueFulfillmentCount: number;
  activeCouponsCount: number;
  dailyRevenue: { date: string; day: string; gross_sales: number; orders_count: number }[];
  topProducts: { product_id: string; product_name: string; units_sold: number; revenue: number }[];
  ordersByStatus: { name: string; value: number }[];
}

export interface AttentionItem {
  id: string;
  title: string;
  count: number;
  severity: "critical" | "warning" | "info";
  link: string;
  roles: CmsRole[];
  badgeText: string;
  description: string;
}

export interface RecentOrderSummary {
  id: string;
  readableId: string;
  status: string;
  total: number;
  createdAt: string;
  formattedDate: string;
  customerName?: string;
  customerPhone?: string;
  customerCity?: string;
  itemCount: number;
  itemsPreview: string;
  isPaid: boolean;
}

/**
 * Calculates start and end timestamps in UTC corresponding to exact calendar boundaries in Asia/Kolkata (IST = UTC+5:30).
 */
export function getPeriodDateBoundaries(
  period: DateRangePeriod,
  now: Date = new Date()
): { startDate: string | null; endDate: string | null; label: string } {
  if (period === "all") {
    return { startDate: null, endDate: null, label: "All Time" };
  }

  // Get current time in IST
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const nowIstMs = now.getTime() + IST_OFFSET_MS;
  const nowIst = new Date(nowIstMs);

  const year = nowIst.getUTCFullYear();
  const month = nowIst.getUTCMonth();
  const date = nowIst.getUTCDate();

  // Helper to convert an IST date components into UTC ISO string
  const toUtcIso = (y: number, m: number, d: number, h: number, min: number, s: number, ms: number) => {
    const istEpoch = Date.UTC(y, m, d, h, min, s, ms);
    return new Date(istEpoch - IST_OFFSET_MS).toISOString();
  };

  if (period === "today") {
    return {
      startDate: toUtcIso(year, month, date, 0, 0, 0, 0),
      endDate: toUtcIso(year, month, date, 23, 59, 59, 999),
      label: "Today (IST)",
    };
  }

  if (period === "yesterday") {
    return {
      startDate: toUtcIso(year, month, date - 1, 0, 0, 0, 0),
      endDate: toUtcIso(year, month, date - 1, 23, 59, 59, 999),
      label: "Yesterday (IST)",
    };
  }

  if (period === "7d") {
    return {
      startDate: toUtcIso(year, month, date - 6, 0, 0, 0, 0),
      endDate: toUtcIso(year, month, date, 23, 59, 59, 999),
      label: "Last 7 Days (IST)",
    };
  }

  if (period === "month") {
    return {
      startDate: toUtcIso(year, month, 1, 0, 0, 0, 0),
      endDate: toUtcIso(year, month, date, 23, 59, 59, 999),
      label: "This Month (IST)",
    };
  }

  return { startDate: null, endDate: null, label: "All Time" };
}

/**
 * Checks whether an order represents a captured payment.
 * Requires: commercial status in ('confirmed', 'shipped', 'delivered') AND non-empty payment reference.
 */
export function isOrderPaid(order: { status: string; stripe_session_id?: string | null }): boolean {
  if (!order) return false;
  const isPaidStatus = PAID_STATUSES.includes(order.status?.toLowerCase());
  const hasPaymentId = Boolean(order.stripe_session_id && order.stripe_session_id.trim().length > 0);
  return isPaidStatus && hasPaymentId;
}

/**
 * Role capability helpers
 */
export function canRoleViewFinancials(roles: string[]): boolean {
  return roles.includes("admin");
}

export function canRoleViewCustomerContact(roles: string[]): boolean {
  return roles.includes("admin") || roles.includes("customer_support");
}

/**
 * Compiles actionable attention items tailored to the user's role.
 */
export function getAttentionItems(
  metrics: DashboardMetrics,
  roles: string[]
): AttentionItem[] {
  const items: AttentionItem[] = [];

  // Out of Stock Products
  if (metrics.outOfStockCount > 0) {
    items.push({
      id: "out-of-stock",
      title: "Products Out of Stock",
      count: metrics.outOfStockCount,
      severity: "critical",
      link: "/admin/inventory",
      roles: ["admin", "inventory_manager"],
      badgeText: "Immediate Action",
      description: `${metrics.outOfStockCount} active products currently have 0 inventory. Replenish stock to avoid lost sales.`,
    });
  }

  // Low Stock Products
  if (metrics.lowStockCount > 0) {
    items.push({
      id: "low-stock",
      title: "Low Stock Alert (<10 units)",
      count: metrics.lowStockCount,
      severity: "warning",
      link: "/admin/inventory",
      roles: ["admin", "inventory_manager"],
      badgeText: "Reorder Needed",
      description: `${metrics.lowStockCount} products are running low on stock.`,
    });
  }

  // Overdue Fulfillment (>24h since confirmation without dispatch)
  if (metrics.overdueFulfillmentCount > 0) {
    items.push({
      id: "overdue-fulfillment",
      title: "Overdue Shipments (>24h)",
      count: metrics.overdueFulfillmentCount,
      severity: "critical",
      link: "/admin/orders",
      roles: ["admin", "inventory_manager", "customer_support"],
      badgeText: "Dispatch Delayed",
      description: `${metrics.overdueFulfillmentCount} confirmed paid orders have been waiting over 24 hours to be shipped.`,
    });
  }

  // Pending Product Reviews
  if (metrics.pendingReviewsCount > 0) {
    items.push({
      id: "pending-reviews",
      title: "Pending Product Reviews",
      count: metrics.pendingReviewsCount,
      severity: "info",
      link: "/admin/reviews",
      roles: ["admin", "moderator", "editor", "content_manager"],
      badgeText: "Moderation Queue",
      description: `${metrics.pendingReviewsCount} customer product reviews waiting for approval.`,
    });
  }

  // Unread Inquiries
  if (metrics.unreadInquiriesCount > 0) {
    items.push({
      id: "unread-inquiries",
      title: "Unresolved Customer Inquiries",
      count: metrics.unreadInquiriesCount,
      severity: "warning",
      link: "/admin/inquiries",
      roles: ["admin", "customer_support", "moderator"],
      badgeText: "Customer Needs Reply",
      description: `${metrics.unreadInquiriesCount} contact form messages are currently new or unanswered.`,
    });
  }

  // Filter items matching the active user's roles
  return items.filter((item) => item.roles.some((r) => roles.includes(r)));
}

/**
 * Pure calculation logic for client-side fallback or unit testing
 */
export function calculateDashboardMetricsFromRawData(
  orders: any[],
  orderItems: any[],
  products: any[],
  reviewsCount = 0,
  inquiriesCount = 0,
  registeredCustomersCount = 0,
  activeCouponsCount = 0,
  deliveries: any[] = []
): DashboardMetrics {
  let grossSales = 0;
  let paidOrdersCount = 0;
  let pendingOrdersCount = 0;
  let cancelledOrdersCount = 0;
  let returnedOrdersCount = 0;
  let refunds = 0;
  const orderingCustomerSet = new Set<string>();
  const statusMap: Record<string, number> = {};

  const paidOrderIds = new Set<string>();

  // Overdue fulfillment: paid orders created > 24 hours ago in 'confirmed' status
  let overdueFulfillmentCount = 0;
  const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;

  for (const o of orders) {
    const status = (o.status || "").toLowerCase();
    statusMap[status] = (statusMap[status] || 0) + 1;

    const total = Number(o.total) || 0;
    const paid = isOrderPaid(o);

    if (paid) {
      grossSales += total;
      paidOrdersCount++;
      paidOrderIds.add(o.id);

      if (o.user_id) {
        orderingCustomerSet.add(o.user_id);
      }

      if (status === "confirmed" && new Date(o.created_at).getTime() < twentyFourHoursAgo) {
        overdueFulfillmentCount++;
      }
    } else if (status === "pending") {
      pendingOrdersCount++;
    } else if (status === "cancelled") {
      cancelledOrdersCount++;
    }
  }

  // Calculate returns / refunds
  for (const d of deliveries) {
    if (d.status === "returned" && d.order_id && paidOrderIds.has(d.order_id)) {
      const match = orders.find((o) => o.id === d.order_id);
      if (match) {
        refunds += Number(match.total) || 0;
        returnedOrdersCount++;
      }
    }
  }

  const netSales = Math.max(0, grossSales - refunds);
  const averageOrderValue = paidOrdersCount > 0 ? Math.round(grossSales / paidOrdersCount) : 0;

  // Catalog stock levels across full catalog
  const totalProductsCount = products.filter((p) => p.is_active !== false).length;
  const lowStockCount = products.filter(
    (p) => p.is_active !== false && (p.stock_quantity || 0) > 0 && (p.stock_quantity || 0) < 10
  ).length;
  const outOfStockCount = products.filter(
    (p) => p.is_active !== false && (p.stock_quantity || 0) <= 0
  ).length;

  // Top products from order_items of paid orders
  const productAgg: Record<string, { product_id: string; product_name: string; units_sold: number; revenue: number }> = {};
  for (const item of orderItems) {
    if (item.order_id && paidOrderIds.has(item.order_id)) {
      const id = item.product_id || item.product_name;
      if (!productAgg[id]) {
        productAgg[id] = {
          product_id: item.product_id || id,
          product_name: item.product_name || "Unknown Product",
          units_sold: 0,
          revenue: 0,
        };
      }
      const qty = Number(item.quantity) || 0;
      const price = Number(item.price) || 0;
      productAgg[id].units_sold += qty;
      productAgg[id].revenue += price * qty;
    }
  }

  const topProducts = Object.values(productAgg)
    .sort((a, b) => b.units_sold - a.units_sold)
    .slice(0, 5);

  // Group daily revenue
  const dailyMap: Record<string, { date: string; day: string; gross_sales: number; orders_count: number }> = {};
  for (const o of orders) {
    if (isOrderPaid(o)) {
      const dateStr = new Date(o.created_at).toISOString().slice(0, 10);
      const dayLabel = formatKolkataDate(o.created_at, false);
      if (!dailyMap[dateStr]) {
        dailyMap[dateStr] = { date: dateStr, day: dayLabel, gross_sales: 0, orders_count: 0 };
      }
      dailyMap[dateStr].gross_sales += Number(o.total) || 0;
      dailyMap[dateStr].orders_count += 1;
    }
  }

  const dailyRevenue = Object.keys(dailyMap)
    .sort()
    .map((k) => dailyMap[k]);

  const ordersByStatus = Object.entries(statusMap).map(([name, value]) => ({ name, value }));

  return {
    grossRevenue: grossSales,
    netRevenue: netSales,
    refunds,
    paidOrdersCount,
    pendingOrdersCount,
    cancelledOrdersCount,
    returnedOrdersCount,
    totalOrdersCount: orders.length,
    averageOrderValue,
    periodOrderingCustomersCount: orderingCustomerSet.size,
    totalRegisteredCustomersCount: registeredCustomersCount,
    totalProductsCount,
    lowStockCount,
    outOfStockCount,
    pendingReviewsCount: reviewsCount,
    unreadInquiriesCount: inquiriesCount,
    overdueFulfillmentCount,
    activeCouponsCount,
    dailyRevenue,
    topProducts,
    ordersByStatus,
  };
}

/**
 * Main dashboard fetcher with Postgres RPC primary path and pure query fallback.
 */
export async function fetchAdminDashboardMetrics(
  period: DateRangePeriod = "all"
): Promise<DashboardMetrics> {
  const boundaries = getPeriodDateBoundaries(period);

  // 1. Primary path: Attempt RPC execution
  try {
    const { data: rpcData, error: rpcError } = await (supabase.rpc as any)(
      "get_admin_dashboard_metrics",
      {
        p_start_date: boundaries.startDate,
        p_end_date: boundaries.endDate,
      }
    );

    if (!rpcError && rpcData) {
      const gross = Number(rpcData.gross_sales) || 0;
      const paidCount = Number(rpcData.paid_orders_count) || 0;
      const aov = paidCount > 0 ? Math.round(gross / paidCount) : 0;

      return {
        grossRevenue: gross,
        netRevenue: Number(rpcData.net_sales) || 0,
        refunds: Number(rpcData.refunds) || 0,
        paidOrdersCount: paidCount,
        pendingOrdersCount: Number(rpcData.pending_orders_count) || 0,
        cancelledOrdersCount: Number(rpcData.cancelled_orders_count) || 0,
        returnedOrdersCount: Number(rpcData.returned_orders_count) || 0,
        totalOrdersCount: Number(rpcData.total_orders_count) || 0,
        averageOrderValue: aov,
        periodOrderingCustomersCount: Number(rpcData.period_ordering_customers_count) || 0,
        totalRegisteredCustomersCount: Number(rpcData.total_registered_customers_count) || 0,
        totalProductsCount: Number(rpcData.total_products_count) || 0,
        lowStockCount: Number(rpcData.low_stock_products_count) || 0,
        outOfStockCount: Number(rpcData.out_of_stock_products_count) || 0,
        pendingReviewsCount: Number(rpcData.pending_reviews_count) || 0,
        unreadInquiriesCount: Number(rpcData.unread_inquiries_count) || 0,
        overdueFulfillmentCount: Number(rpcData.overdue_fulfillment_count) || 0,
        activeCouponsCount: Number(rpcData.active_coupons_count) || 0,
        dailyRevenue: Array.isArray(rpcData.daily_revenue) ? rpcData.daily_revenue : [],
        topProducts: Array.isArray(rpcData.top_products) ? rpcData.top_products : [],
        ordersByStatus: Array.isArray(rpcData.orders_by_status) ? rpcData.orders_by_status : [],
      };
    }
  } catch (rpcErr) {
    // Graceful fallback to client queries if RPC is not yet created in the DB
  }

  // 2. Fallback path: Uncapped parallel queries
  let orderQuery = supabase
    .from("orders")
    .select("id, user_id, status, total, created_at, stripe_session_id");

  if (boundaries.startDate) {
    orderQuery = orderQuery.gte("created_at", boundaries.startDate);
  }
  if (boundaries.endDate) {
    orderQuery = orderQuery.lte("created_at", boundaries.endDate);
  }

  const [
    { data: orders },
    { data: orderItems },
    { data: products },
    { count: reviewCount },
    { count: registeredCustomersCount },
    { count: activeCouponsCount },
    { data: deliveries },
  ] = await Promise.all([
    orderQuery,
    supabase.from("order_items").select("order_id, product_id, product_name, price, quantity"),
    supabase.from("products").select("id, name, is_active, stock_quantity"),
    supabase.from("reviews").select("*", { count: "exact", head: true }).eq("is_approved", false),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("coupons").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("deliveries").select("order_id, status"),
  ]);

  let inquiriesCount = 0;
  try {
    const { count } = await (supabase.from("inquiries" as any) as any)
      .select("*", { count: "exact", head: true })
      .in("status", ["new", "pending", "unread"]);
    inquiriesCount = count || 0;
  } catch {
    inquiriesCount = 0;
  }

  return calculateDashboardMetricsFromRawData(
    orders || [],
    orderItems || [],
    products || [],
    reviewCount || 0,
    inquiriesCount,
    registeredCustomersCount || 0,
    activeCouponsCount || 0,
    deliveries || []
  );
}

/**
 * Fetches recent orders with item summaries and readable identifiers.
 */
export async function fetchRecentOrders(limit = 6): Promise<RecentOrderSummary[]> {
  try {
    const { data: orders, error } = await supabase
      .from("orders")
      .select(`
        id,
        status,
        total,
        created_at,
        stripe_session_id,
        address_snapshot,
        order_items (
          product_name,
          quantity
        )
      `)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !orders) return [];

    return orders.map((o: any) => {
      const shortId = `#LK-${o.id.slice(0, 6).toUpperCase()}`;
      const items = Array.isArray(o.order_items) ? o.order_items : [];
      const itemCount = items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 1), 0);
      const itemsPreview = items.length > 0
        ? items.map((it: any) => `${it.product_name} (x${it.quantity})`).join(", ")
        : "Products";

      const addr = o.address_snapshot || {};
      const customerName = addr.name || addr.full_name || undefined;
      const customerPhone = addr.phone || undefined;
      const customerCity = addr.city || undefined;

      return {
        id: o.id,
        readableId: shortId,
        status: o.status,
        total: Number(o.total) || 0,
        createdAt: o.created_at,
        formattedDate: formatKolkataDate(o.created_at),
        customerName,
        customerPhone,
        customerCity,
        itemCount,
        itemsPreview,
        isPaid: isOrderPaid(o),
      };
    });
  } catch (err) {
    console.error("Failed to load recent orders:", err);
    return [];
  }
}
