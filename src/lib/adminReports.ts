/**
 * Admin Reports Engine & Safety Utilities
 * 
 * Provides truthful, real-data calculations for sales, inventory, orders, and subscriptions.
 * Enforces Asia/Kolkata timezone formatting and strict CSV formula injection sanitization.
 */

export interface RawOrder {
  id: string;
  user_id?: string;
  status: string;
  subtotal: number | string;
  discount?: number | string | null;
  loyalty_discount?: number | string | null;
  shipping?: number | string | null;
  total: number | string;
  address_snapshot?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
  } | null;
  created_at: string;
}

export interface RawOrderItem {
  id?: string;
  order_id: string;
  product_id: string;
  product_name: string;
  price: number | string;
  quantity: number;
  created_at?: string;
}

export interface SalesReportMetrics {
  paidOrdersCount: number;
  cancelledOrdersCount: number;
  pendingOrdersCount: number;
  totalOrdersCount: number;
  grossSales: number;
  totalDiscounts: number;
  couponDiscounts: number;
  loyaltyDiscounts: number;
  shippingRecorded: number;
  netSales: number;
  totalRevenue: number;
  averageOrderValue: number;
  taxesNote: string;
  refundsNote: string;
}

export interface ProductPerformanceMetric {
  productId: string;
  productName: string;
  unitsSold: number;
  grossRevenue: number;
  ordersCount: number;
}

export const PAID_STATUSES = ["confirmed", "shipped", "delivered"];

/**
 * Format timestamp strictly in Asia/Kolkata timezone (IST)
 */
export function formatKolkataDate(dateInput: string | Date | number, includeTime = true): string {
  if (!dateInput) return "N/A";
  const date = typeof dateInput === "string" || typeof dateInput === "number" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "Invalid Date";

  const options: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "short",
    day: "2-digit",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit", hour12: true } : {}),
  };

  return new Intl.DateTimeFormat("en-IN", options).format(date);
}

/**
 * Filter orders within a date range (based on created_at in ISO / UTC)
 */
export function filterOrdersByDateRange(
  orders: RawOrder[],
  startDate?: string | null,
  endDate?: string | null
): RawOrder[] {
  return orders.filter((order) => {
    if (!order.created_at) return false;
    const orderTime = new Date(order.created_at).getTime();
    if (isNaN(orderTime)) return false;

    if (startDate) {
      const start = new Date(startDate).setHours(0, 0, 0, 0);
      if (orderTime < start) return false;
    }
    if (endDate) {
      const end = new Date(endDate).setHours(23, 59, 59, 999);
      if (orderTime > end) return false;
    }
    return true;
  });
}

/**
 * Calculate truthful sales metrics based strictly on source-of-truth orders
 */
export function calculateSalesMetrics(orders: RawOrder[]): SalesReportMetrics {
  let grossSales = 0;
  let couponDiscounts = 0;
  let loyaltyDiscounts = 0;
  let shippingRecorded = 0;
  let totalRevenue = 0;

  let paidOrdersCount = 0;
  let cancelledOrdersCount = 0;
  let pendingOrdersCount = 0;

  for (const o of orders) {
    const isPaid = PAID_STATUSES.includes(o.status);
    if (isPaid) {
      paidOrdersCount++;
      const subtotal = Number(o.subtotal) || 0;
      const couponDisc = Number(o.discount) || 0;
      const loyaltyDisc = Number(o.loyalty_discount) || 0;
      const shipping = Number(o.shipping) || 0;
      const total = Number(o.total) || 0;

      grossSales += subtotal;
      couponDiscounts += couponDisc;
      loyaltyDiscounts += loyaltyDisc;
      shippingRecorded += shipping;
      totalRevenue += total;
    } else if (o.status === "cancelled") {
      cancelledOrdersCount++;
    } else if (o.status === "pending") {
      pendingOrdersCount++;
    }
  }

  const totalDiscounts = couponDiscounts + loyaltyDiscounts;
  const netSales = Math.max(0, grossSales - totalDiscounts);
  const averageOrderValue = paidOrdersCount > 0 ? totalRevenue / paidOrdersCount : 0;

  return {
    paidOrdersCount,
    cancelledOrdersCount,
    pendingOrdersCount,
    totalOrdersCount: orders.length,
    grossSales: Number(grossSales.toFixed(2)),
    totalDiscounts: Number(totalDiscounts.toFixed(2)),
    couponDiscounts: Number(couponDiscounts.toFixed(2)),
    loyaltyDiscounts: Number(loyaltyDiscounts.toFixed(2)),
    shippingRecorded: Number(shippingRecorded.toFixed(2)),
    netSales: Number(netSales.toFixed(2)),
    totalRevenue: Number(totalRevenue.toFixed(2)),
    averageOrderValue: Number(averageOrderValue.toFixed(2)),
    taxesNote: "Inclusive in product pricing (Indian GST); no separate surcharge column in database.",
    refundsNote: "Automated refund tracking requires payment gateway refund sync; returns are tracked in deliveries.",
  };
}

/**
 * Calculate product performance from paid order items
 */
export function calculateProductPerformance(
  orders: RawOrder[],
  orderItems: RawOrderItem[]
): ProductPerformanceMetric[] {
  const paidOrderIds = new Set(orders.filter((o) => PAID_STATUSES.includes(o.status)).map((o) => o.id));

  const performanceMap = new Map<string, ProductPerformanceMetric>();

  for (const item of orderItems) {
    if (!paidOrderIds.has(item.order_id)) continue;

    const existing = performanceMap.get(item.product_id) || {
      productId: item.product_id,
      productName: item.product_name,
      unitsSold: 0,
      grossRevenue: 0,
      ordersCount: 0,
    };

    const qty = Number(item.quantity) || 0;
    const price = Number(item.price) || 0;

    existing.unitsSold += qty;
    existing.grossRevenue += qty * price;
    existing.ordersCount += 1;

    performanceMap.set(item.product_id, existing);
  }

  return Array.from(performanceMap.values())
    .map((p) => ({ ...p, grossRevenue: Number(p.grossRevenue.toFixed(2)) }))
    .sort((a, b) => b.grossRevenue - a.grossRevenue);
}

/**
 * Sanitize CSV cell values to prevent CSV Formula Injection (CWE-1236)
 * Prepends a single quote if the value starts with =, +, -, @, tab, or carriage return.
 */
export function sanitizeCsvCell(value: any): string {
  if (value === null || value === undefined) return '""';
  let str = String(value);

  // If the string starts with formula trigger characters, prefix with single quote
  const formulaTriggers = ["=", "+", "-", "@", "\t", "\r"];
  if (formulaTriggers.some((char) => str.startsWith(char))) {
    str = `'${str}`;
  }

  // Escape inner double quotes by doubling them
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Build CSV string from rows with formula injection safety
 */
export function generateSafeCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const headerLine = headers.map((h) => sanitizeCsvCell(h)).join(",");
  const rowLines = rows.map((row) => row.map((cell) => sanitizeCsvCell(cell)).join(","));
  return [headerLine, ...rowLines].join("\r\n");
}

/**
 * Trigger CSV download with feature-flag guard
 */
export function downloadReportCsv(filename: string, content: string, isEnabled = true): void {
  if (!isEnabled) {
    throw new Error("CSV report downloads are disabled by the Master Administrator.");
  }
  if (typeof document === "undefined") return;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

