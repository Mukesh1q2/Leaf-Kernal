import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Package,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Users,
  Star,
  AlertTriangle,
  Gift,
  RefreshCw,
  Clock,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  Truck,
  MessageSquare,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { useCmsAuth } from "@/components/admin/AdminLayout";
import { canAccessRoute } from "@/lib/cmsRoles";
import {
  DateRangePeriod,
  DashboardMetrics,
  RecentOrderSummary,
  fetchAdminDashboardMetrics,
  fetchRecentOrders,
  getAttentionItems,
  canRoleViewFinancials,
  canRoleViewCustomerContact,
} from "@/lib/dashboardMetrics";
import {
  fetchActiveStorefrontAnnouncement,
  type ActiveStorefrontAnnouncement,
} from "@/lib/announcements";

const PIE_COLORS = [
  "hsl(150, 40%, 18%)",
  "hsl(90, 30%, 45%)",
  "hsl(38, 40%, 70%)",
  "hsl(0, 84%, 60%)",
  "hsl(220, 60%, 50%)",
];

const QUICK_ACTION_ITEMS = [
  { label: "+ Add Product", url: "/admin/products", roles: ["admin", "editor", "content_manager", "inventory_manager"] },
  { label: "Inventory & Stock", url: "/admin/inventory", roles: ["admin", "inventory_manager"] },
  { label: "View Orders", url: "/admin/orders", roles: ["admin", "customer_support"] },
  { label: "Deliveries", url: "/admin/deliveries", roles: ["admin", "customer_support", "inventory_manager"] },
  { label: "Moderate Reviews", url: "/admin/reviews", roles: ["admin", "moderator", "customer_support", "editor", "content_manager"] },
  { label: "Customer Inquiries", url: "/admin/inquiries", roles: ["admin", "customer_support", "moderator"] },
  { label: "Announcement Bar", url: "/admin/announcements", roles: ["admin", "editor", "content_manager"] },
  { label: "Manage Coupons", url: "/admin/coupons", roles: ["admin"] },
  { label: "+ Write Blog Post", url: "/admin/blog", roles: ["admin", "editor", "content_manager"] },
  { label: "Store Settings", url: "/admin/settings", roles: ["admin"] },
];

export const AdminDashboard = () => {
  const { roles, isMaster } = useCmsAuth();

  const [period, setPeriod] = useState<DateRangePeriod>("7d");
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrderSummary[]>([]);
  const [promoAnnouncement, setPromoAnnouncement] = useState<ActiveStorefrontAnnouncement | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [topProductsMetric, setTopProductsMetric] = useState<"units" | "revenue">("units");

  const showFinancials = canRoleViewFinancials(roles);
  const showCustomerDetails = canRoleViewCustomerContact(roles);

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [metricsData, ordersData, promoData] = await Promise.all([
        fetchAdminDashboardMetrics(period),
        fetchRecentOrders(6),
        fetchActiveStorefrontAnnouncement(),
      ]);

      setMetrics(metricsData);
      setRecentOrders(ordersData);
      setPromoAnnouncement(promoData);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard metrics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [period]);

  const attentionItems = useMemo(() => {
    if (!metrics) return [];
    return getAttentionItems(metrics, roles);
  }, [metrics, roles]);

  const permittedQuickActions = useMemo(() => {
    return QUICK_ACTION_ITEMS.filter((item) =>
      canAccessRoute(roles, item.url, isMaster)
    );
  }, [roles, isMaster]);

  // Formatted Top Products for Bar Chart
  const topProductsChartData = useMemo(() => {
    if (!metrics?.topProducts) return [];
    return metrics.topProducts.map((p) => ({
      name: p.product_name.length > 18 ? p.product_name.slice(0, 18) + "…" : p.product_name,
      fullName: p.product_name,
      units: p.units_sold,
      revenue: p.revenue,
    }));
  }, [metrics?.topProducts]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* 1. Header Bar: Title, Role Badge, Period Filter, Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-2xl font-heading font-bold text-foreground">Dashboard Overview</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Operational and business pulse • Day boundaries calculated in India Standard Time (IST)
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Period Filter */}
          <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-lg border border-border">
            <Calendar className="h-3.5 w-3.5 ml-1.5 text-muted-foreground" />
            <Select value={period} onValueChange={(val: DateRangePeriod) => setPeriod(val)}>
              <SelectTrigger className="h-7 text-xs border-0 bg-transparent shadow-none focus:ring-0">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today (IST)</SelectItem>
                <SelectItem value="yesterday">Yesterday (IST)</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Refresh Button with Timestamp */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => loadData(true)}
            disabled={loading || refreshing}
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Updating..." : "Refresh"}
          </Button>

          <span className="text-[11px] text-muted-foreground hidden lg:inline">
            Updated {lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => loadData()}>
            Retry
          </Button>
        </div>
      )}

      {/* 2. ATTENTION NEEDED HUB (Priority 3) */}
      {!loading && attentionItems.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5 shadow-xs">
          <CardHeader className="py-3 px-5 border-b border-amber-500/20">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Attention Needed ({attentionItems.length})
              </CardTitle>
              <span className="text-[11px] text-muted-foreground">Action items for your role</span>
            </div>
          </CardHeader>
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {attentionItems.map((item) => (
              <Link
                key={item.id}
                to={item.link}
                className="p-3 rounded-lg border border-border/80 bg-background hover:bg-muted/40 transition-colors flex flex-col justify-between group shadow-2xs"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors">
                      {item.title}
                    </span>
                    <Badge
                      variant={item.severity === "critical" ? "destructive" : "secondary"}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {item.count}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{item.description}</p>
                </div>
                <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between text-[11px] text-primary font-medium">
                  <span>{item.badgeText}</span>
                  <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 3. ROLE-TAILORED KPI CARDS (Priorities 1 & 2) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            {/* Financial Cards (Admin Only) */}
            {showFinancials && (
              <>
                <Card className="hover:shadow-sm transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Gross Sales</CardTitle>
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold text-foreground">
                      ₹{(metrics?.grossRevenue || 0).toLocaleString("en-IN")}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Captured payments in period</p>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-sm transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Net Revenue</CardTitle>
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold text-foreground">
                      ₹{(metrics?.netRevenue || 0).toLocaleString("en-IN")}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {metrics?.refunds && metrics.refunds > 0
                        ? `After ₹${metrics.refunds.toLocaleString("en-IN")} returns`
                        : "Excludes cancelled & returns"}
                    </p>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-sm transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Paid Orders</CardTitle>
                    <ShoppingCart className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold text-foreground">
                      {(metrics?.paidOrdersCount || 0).toLocaleString()}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      of {metrics?.totalOrdersCount || 0} total created
                    </p>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-sm transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Average Order Value</CardTitle>
                    <DollarSign className="h-4 w-4 text-secondary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold text-foreground">
                      ₹{(metrics?.averageOrderValue || 0).toLocaleString("en-IN")}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Per paid order</p>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Inventory Metrics */}
            <Link to="/admin/inventory">
              <Card className="hover:shadow-sm transition-shadow cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground">Active Catalog</CardTitle>
                  <Package className="h-4 w-4 text-secondary" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-foreground">
                    {metrics?.totalProductsCount || 0}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Active products</p>
                </CardContent>
              </Card>
            </Link>

            <Link to="/admin/inventory">
              <Card className="hover:shadow-sm transition-shadow cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground">Low / Out of Stock</CardTitle>
                  <AlertTriangle className={`h-4 w-4 ${(metrics?.outOfStockCount || 0) > 0 ? "text-destructive" : "text-amber-500"}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-foreground flex items-center gap-1.5">
                    <span>{metrics?.lowStockCount || 0}</span>
                    {(metrics?.outOfStockCount || 0) > 0 && (
                      <span className="text-xs font-normal text-destructive">
                        ({metrics?.outOfStockCount} out)
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Full catalog scan</p>
                </CardContent>
              </Card>
            </Link>

            {/* Customer Metrics */}
            <Link to="/admin/customers">
              <Card className="hover:shadow-sm transition-shadow cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground">Ordering Customers</CardTitle>
                  <Users className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-foreground">
                    {metrics?.periodOrderingCustomersCount || 0}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    in period ({metrics?.totalRegisteredCustomersCount || 0} registered)
                  </p>
                </CardContent>
              </Card>
            </Link>

            {/* Pending Reviews or Overdue Dispatch */}
            <Link to="/admin/reviews">
              <Card className="hover:shadow-sm transition-shadow cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground">Pending Reviews</CardTitle>
                  <Star className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-foreground">
                    {metrics?.pendingReviewsCount || 0}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Awaiting moderation</p>
                </CardContent>
              </Card>
            </Link>
          </>
        )}
      </div>

      {/* 4. CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue & Volume Trend (Admin only) or Operations Breakdown */}
        {showFinancials ? (
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-sm font-semibold">Captured Revenue Trend</CardTitle>
                <CardDescription className="text-xs">
                  Daily captured sales volume in selected period (India Time)
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[250px] w-full" />
              ) : !metrics?.dailyRevenue || metrics.dailyRevenue.length === 0 ? (
                <div className="h-[250px] flex flex-col items-center justify-center text-muted-foreground text-xs">
                  <DollarSign className="h-8 w-8 mb-2 opacity-40" />
                  <span>No captured revenue recorded in this period</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={metrics.dailyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Captured Revenue"]}
                      labelFormatter={(l) => `Date: ${l}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="gross_sales"
                      stroke="hsl(150, 40%, 18%)"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Operations Summary</CardTitle>
              <CardDescription className="text-xs">Fulfillment and inquiry workload status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/40 border">
                  <span className="text-xs text-muted-foreground">Orders Pending Dispatch</span>
                  <div className="text-2xl font-bold text-foreground mt-1">
                    {metrics?.pendingOrdersCount || 0}
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-muted/40 border">
                  <span className="text-xs text-muted-foreground">Unread Inquiries</span>
                  <div className="text-2xl font-bold text-foreground mt-1">
                    {metrics?.unreadInquiriesCount || 0}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Commercial Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Orders by Status</CardTitle>
            <CardDescription className="text-xs">Commercial lifecycle in selected period</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : !metrics?.ordersByStatus || metrics.ordersByStatus.length === 0 ? (
              <div className="h-[250px] flex flex-col items-center justify-center text-muted-foreground text-xs">
                <ShoppingCart className="h-8 w-8 mb-2 opacity-40" />
                <span>No orders placed in this period</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={metrics.ordersByStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {metrics.ordersByStatus.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: number, name: string) => [`${val} orders`, name.toUpperCase()]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 5. TOP PRODUCTS (CALCULATED FROM ORDER ITEMS) & PROMOTIONS STATUS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products Bar Chart */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-sm font-semibold">
                Top Products {topProductsMetric === "units" ? "(By Units Sold)" : "(By Revenue)"}
              </CardTitle>
              <CardDescription className="text-xs">
                Calculated strictly from paid order items in this period
              </CardDescription>
            </div>
            {/* Toggle Units vs Revenue */}
            <div className="flex items-center gap-1 bg-muted p-0.5 rounded-md border text-xs">
              <Button
                variant={topProductsMetric === "units" ? "default" : "ghost"}
                size="sm"
                className="h-6 px-2 text-[11px]"
                onClick={() => setTopProductsMetric("units")}
              >
                Units
              </Button>
              <Button
                variant={topProductsMetric === "revenue" ? "default" : "ghost"}
                size="sm"
                className="h-6 px-2 text-[11px]"
                onClick={() => setTopProductsMetric("revenue")}
              >
                Revenue
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : topProductsChartData.length === 0 ? (
              <div className="h-[220px] flex flex-col items-center justify-center text-muted-foreground text-xs">
                <Package className="h-8 w-8 mb-2 opacity-40" />
                <span>No product sales recorded in this period</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topProductsChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: number) =>
                      topProductsMetric === "units" ? [`${v} units sold`, "Units Sold"] : [`₹${v.toLocaleString("en-IN")}`, "Gross Revenue"]
                    }
                  />
                  <Bar
                    dataKey={topProductsMetric === "units" ? "units" : "revenue"}
                    fill="hsl(90, 30%, 45%)"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Active Storefront Promotion & Marketing Pulse (Priority 4) */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary" /> Storefront Announcement & Promotions
              </CardTitle>
              <Badge variant={promoAnnouncement ? "default" : "secondary"} className="text-[11px]">
                {promoAnnouncement ? "🟢 Live on Storefront" : "Paused / None Active"}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Top announcement strip and coupon currently visible to customers
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {promoAnnouncement ? (
              <div className="p-3.5 rounded-lg border bg-muted/30 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium text-foreground">
                    "{promoAnnouncement.announcement_copy}"
                  </p>
                  <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                    Free shipping ≥ ₹{promoAnnouncement.free_shipping_threshold}
                  </span>
                </div>

                {promoAnnouncement.coupon ? (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] text-muted-foreground">Linked coupon:</span>
                    <Badge variant="outline" className="font-mono text-xs font-semibold bg-background">
                      {promoAnnouncement.coupon.code}
                    </Badge>
                    <span className="text-xs text-secondary font-medium">
                      ({promoAnnouncement.coupon.discount_label})
                    </span>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground italic">
                    (No coupon linked — text only)
                  </p>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-lg border border-dashed text-center text-xs text-muted-foreground">
                No active announcement bar is currently scheduled or published.
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">
                Active CMS Coupons: <strong className="text-foreground">{metrics?.activeCouponsCount || 0}</strong>
              </span>

              {canAccessRoute(roles, "/admin/announcements", isMaster) && (
                <Button variant="outline" size="sm" asChild className="text-xs h-7">
                  <Link to="/admin/announcements">
                    Edit Announcement Bar <ExternalLink className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 6. ROLE-FILTERED QUICK ACTIONS & RECENT ORDERS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions (Filtered by RBAC) */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
            <CardDescription className="text-xs">Shortcuts permitted for your role</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2">
            {permittedQuickActions.map((action) => (
              <Button
                key={action.url}
                variant="outline"
                size="sm"
                asChild
                className="justify-between text-xs hover:bg-muted font-medium h-9"
              >
                <Link to={action.url}>
                  <span>{action.label}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>

        {/* Recent Orders (With IST timestamps, readable IDs, item summaries) */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-sm font-semibold">Recent Orders</CardTitle>
              <CardDescription className="text-xs">Latest customer checkouts</CardDescription>
            </div>
            {canAccessRoute(roles, "/admin/orders", isMaster) && (
              <Button variant="ghost" size="sm" asChild className="text-xs h-7">
                <Link to="/admin/orders">View All Orders →</Link>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No orders recorded yet.</p>
            ) : (
              <div className="divide-y divide-border/60">
                {recentOrders.map((o) => (
                  <div key={o.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground">{o.readableId}</span>
                        <span
                          className={`capitalize px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            o.status === "confirmed"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200"
                              : o.status === "shipped"
                              ? "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200"
                              : o.status === "delivered"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200"
                              : o.status === "pending"
                              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200"
                              : "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200"
                          }`}
                        >
                          {o.status}
                        </span>
                        {o.isPaid ? (
                          <Badge variant="outline" className="text-[10px] text-green-600 border-green-300 py-0">
                            Paid
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 py-0">
                            Unpaid
                          </Badge>
                        )}
                      </div>

                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {o.itemsPreview} ({o.itemCount} items)
                      </p>

                      {/* Customer Info (Permitted roles only) */}
                      {showCustomerDetails && o.customerName && (
                        <p className="text-[10px] text-muted-foreground/80 mt-0.5">
                          Customer: <span className="font-medium text-foreground">{o.customerName}</span>
                          {o.customerCity ? ` • ${o.customerCity}` : ""}
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-bold text-sm text-foreground">
                        ₹{o.total.toLocaleString("en-IN")}
                      </div>
                      <span className="text-[10px] text-muted-foreground">{o.formattedDate}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
