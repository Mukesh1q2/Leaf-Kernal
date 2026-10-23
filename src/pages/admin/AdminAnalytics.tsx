import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Download,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Package,
  ShoppingCart,
  Truck,
  Info,
  Calendar,
  Layers,
  FileSpreadsheet,
  FileCode,
} from "lucide-react";
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
} from "recharts";
import {
  calculateSalesMetrics,
  calculateProductPerformance,
  filterOrdersByDateRange,
  formatKolkataDate,
  generateSafeCsv,
  downloadReportCsv,
  PAID_STATUSES,
  type RawOrder,
  type RawOrderItem,
} from "@/lib/adminReports";
import {
  validateAndBuildFeed,
  generateGoogleMerchantXml,
  generateMetaCatalogCsv,
  type FeedProductInput,
} from "@/lib/feedGenerator";
import {
  getFeatureFlags,
  FEATURE_FLAGS_CHANGED_EVENT,
  type FeatureFlag,
  type FeatureKey,
} from "@/lib/featureFlags";
import { useToast } from "@/hooks/use-toast";

const CHART_COLORS = [
  "hsl(136, 49%, 16%)",
  "hsl(83, 55%, 38%)",
  "hsl(121, 45%, 26%)",
  "hsl(220, 60%, 50%)",
  "hsl(38, 70%, 50%)",
  "hsl(0, 75%, 55%)",
];

const AdminAnalytics = () => {
  const { toast } = useToast();
  const [flags, setFlags] = useState<Record<FeatureKey, FeatureFlag> | null>(null);
  const [orders, setOrders] = useState<RawOrder[]>([]);
  const [orderItems, setOrderItems] = useState<RawOrderItem[]>([]);
  const [products, setProducts] = useState<FeedProductInput[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<string>("all");

  const isAnalyticsEnabled = flags?.admin_analytics?.is_enabled ?? true;
  const isCsvEnabled = flags?.csv_downloads?.is_enabled ?? true;
  const isGmcEnabled = flags?.gmc_feed?.is_enabled ?? true;
  const isMetaEnabled = flags?.meta_feed?.is_enabled ?? true;

  useEffect(() => {
    let isMounted = true;

    const loadConfigAndData = async () => {
      setLoading(true);
      try {
        const currentFlags = await getFeatureFlags();
        if (!isMounted) return;
        setFlags(currentFlags);

        // Fetch products for feed catalog
        const { data: productsData } = await supabase
          .from("products")
          .select("id, name, slug, description, short_description, price, original_price, stock_quantity, image_url, is_active, badge");

        if (isMounted) setProducts(productsData || []);

        // Guard: Query orders and items ONLY if admin_analytics is enabled
        if (currentFlags.admin_analytics?.is_enabled) {
          const [
            { data: ordersData },
            { data: itemsData },
          ] = await Promise.all([
            supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(1000),
            supabase.from("order_items").select("*").limit(2000),
          ]);

          if (isMounted) {
            setOrders(ordersData || []);
            setOrderItems(itemsData || []);
          }
        } else {
          if (isMounted) {
            setOrders([]);
            setOrderItems([]);
          }
        }
      } catch (err) {
        console.error("Error loading analytics data", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadConfigAndData();

    const handleFlagsUpdate = () => {
      loadConfigAndData();
    };
    window.addEventListener(FEATURE_FLAGS_CHANGED_EVENT, handleFlagsUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener(FEATURE_FLAGS_CHANGED_EVENT, handleFlagsUpdate);
    };
  }, []);

  // Compute date filter boundary
  const { filteredOrders, dateRangeLabel } = useMemo(() => {
    if (dateRange === "all") {
      return { filteredOrders: orders, dateRangeLabel: "All Time" };
    }

    const now = new Date();
    let startDate: string | null = null;

    if (dateRange === "today") {
      startDate = now.toISOString().slice(0, 10);
    } else if (dateRange === "7d") {
      const d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      startDate = d.toISOString().slice(0, 10);
    } else if (dateRange === "30d") {
      const d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      startDate = d.toISOString().slice(0, 10);
    }

    return {
      filteredOrders: filterOrdersByDateRange(orders, startDate),
      dateRangeLabel: dateRange === "today" ? "Today" : dateRange === "7d" ? "Last 7 Days" : "Last 30 Days",
    };
  }, [orders, dateRange]);

  // Real Sales Metrics (No fabricated estimates)
  const salesMetrics = useMemo(() => calculateSalesMetrics(filteredOrders), [filteredOrders]);

  // Real Product Performance
  const productPerformance = useMemo(
    () => calculateProductPerformance(filteredOrders, orderItems),
    [filteredOrders, orderItems]
  );

  // Feed Diagnostics
  const feedReport = useMemo(() => validateAndBuildFeed(products), [products]);

  // Chart: Daily Paid Revenue (Asia/Kolkata timezone)
  const dailyPaidRevenueData = useMemo(() => {
    const dayMap: Record<string, number> = {};
    const paidOnly = filteredOrders.filter((o) => PAID_STATUSES.includes(o.status));

    paidOnly.forEach((o) => {
      const day = formatKolkataDate(o.created_at, false);
      dayMap[day] = (dayMap[day] || 0) + Number(o.total);
    });

    return Object.entries(dayMap)
      .map(([date, total]) => ({ date, total: Number(total.toFixed(2)) }))
      .slice(-14);
  }, [filteredOrders]);

  // Chart: Order Status Distribution
  const orderStatusData = useMemo(() => {
    const countMap: Record<string, number> = {};
    filteredOrders.forEach((o) => {
      countMap[o.status] = (countMap[o.status] || 0) + 1;
    });
    return Object.entries(countMap).map(([name, value]) => ({ name, value }));
  }, [filteredOrders]);

  // Safe CSV Exports
  const handleExportSalesCsv = () => {
    if (!isCsvEnabled) {
      toast({
        title: "Action Prohibited",
        description: "CSV report downloads are disabled by the Master Administrator.",
        variant: "destructive",
      });
      return;
    }
    const headers = [
      "Order ID",
      "Created (Asia/Kolkata)",
      "Status",
      "Gross Subtotal (INR)",
      "Coupon Discount (INR)",
      "Loyalty Discount (INR)",
      "Shipping (INR)",
      "Net Total Paid (INR)",
      "Customer State",
    ];

    const rows = filteredOrders.map((o) => [
      o.id,
      formatKolkataDate(o.created_at, true),
      o.status,
      Number(o.subtotal || 0).toFixed(2),
      Number(o.discount || 0).toFixed(2),
      Number(o.loyalty_discount || 0).toFixed(2),
      Number(o.shipping || 0).toFixed(2),
      Number(o.total || 0).toFixed(2),
      o.address_snapshot?.state || "Unrecorded",
    ]);

    const csvContent = generateSafeCsv(headers, rows);
    try {
      downloadReportCsv(`uvediq-sales-report-${dateRange}.csv`, csvContent, isCsvEnabled);
      toast({ title: "Sales report downloaded successfully" });
    } catch (err: any) {
      toast({ title: "Export Error", description: err.message, variant: "destructive" });
    }
  };

  const handleExportProductPerformanceCsv = () => {
    if (!isCsvEnabled) {
      toast({
        title: "Action Prohibited",
        description: "CSV report downloads are disabled by the Master Administrator.",
        variant: "destructive",
      });
      return;
    }
    const headers = [
      "Rank",
      "Product ID",
      "Product Name",
      "Units Sold (Paid Orders)",
      "Gross Revenue (INR)",
      "Paid Orders Count",
    ];

    const rows = productPerformance.map((p, idx) => [
      idx + 1,
      p.productId,
      p.productName,
      p.unitsSold,
      p.grossRevenue.toFixed(2),
      p.ordersCount,
    ]);

    const csvContent = generateSafeCsv(headers, rows);
    try {
      downloadReportCsv(`uvediq-product-performance-${dateRange}.csv`, csvContent, isCsvEnabled);
      toast({ title: "Product performance report downloaded" });
    } catch (err: any) {
      toast({ title: "Export Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDownloadGoogleMerchantXml = () => {
    if (!isGmcEnabled) {
      toast({
        title: "Feed Disabled",
        description: "Google Merchant Center feed generation is disabled by the Master Administrator.",
        variant: "destructive",
      });
      return;
    }
    try {
      const xml = generateGoogleMerchantXml(feedReport.validItems, isGmcEnabled);
      const blob = new Blob([xml], { type: "application/xml;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "google-merchant-feed.xml";
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: "GMC XML feed generated" });
    } catch (err: any) {
      toast({ title: "Feed Generation Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDownloadMetaCatalogCsv = () => {
    if (!isMetaEnabled) {
      toast({
        title: "Feed Disabled",
        description: "Meta Catalog feed generation is disabled by the Master Administrator.",
        variant: "destructive",
      });
      return;
    }
    try {
      const csv = generateMetaCatalogCsv(feedReport.validItems, isMetaEnabled);
      downloadReportCsv("meta-product-catalog.csv", csv, isMetaEnabled);
      toast({ title: "Meta catalog CSV generated" });
    } catch (err: any) {
      toast({ title: "Feed Generation Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner when Analytics is disabled */}
      {!isAnalyticsEnabled && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 flex items-center justify-between gap-3 text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold text-sm">Analytics & Financial Reporting Suspended</p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Order querying and live metric calculations are disabled by the Master Administrator in Feature Controls.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-heading font-bold text-foreground">Sales & Discovery Reports</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Verified source-of-truth analytics • All timestamps in Asia/Kolkata (IST)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange} disabled={!isAnalyticsEnabled}>
            <SelectTrigger className="w-36 h-9 text-xs">
              <Calendar className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportSalesCsv}
            disabled={!isCsvEnabled || !isAnalyticsEnabled}
            className="h-9 text-xs"
            title={!isCsvEnabled ? "CSV downloads disabled in Feature Controls" : undefined}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" /> Export Sales CSV {!isCsvEnabled && "(Disabled)"}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="sales" className="space-y-6">
        <TabsList className="bg-muted">
          <TabsTrigger value="sales" className="text-xs">Sales & Financials</TabsTrigger>
          <TabsTrigger value="products" className="text-xs">Product Performance</TabsTrigger>
          <TabsTrigger value="discovery" className="text-xs">Google & Meta Feeds</TabsTrigger>
          <TabsTrigger value="integrations" className="text-xs">Integration Status</TabsTrigger>
        </TabsList>

        {/* Tab 1: Sales & Financials */}
        <TabsContent value="sales" className="space-y-6">
          {!isAnalyticsEnabled ? (
            <Card className="border-border/60 bg-muted/20">
              <CardContent className="py-16 text-center text-muted-foreground">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50 text-amber-600" />
                <h3 className="font-semibold text-foreground text-sm">Sales Reporting is Disabled</h3>
                <p className="text-xs max-w-sm mx-auto mt-1">
                  The Master Administrator has toggled off admin analytics in Feature Controls. Live order queries and metric calculation are suspended.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-1.5">
                <CardTitle className="text-xs font-medium text-muted-foreground">Gross Sales</CardTitle>
                <CardDescription className="text-[10px]">Product value before discounts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-foreground">₹{salesMetrics.grossSales.toLocaleString("en-IN")}</div>
                <div className="text-[11px] text-muted-foreground mt-1">Across {salesMetrics.paidOrdersCount} paid orders</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1.5">
                <CardTitle className="text-xs font-medium text-muted-foreground">Discounts Applied</CardTitle>
                <CardDescription className="text-[10px]">Coupons + Loyalty Points</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-destructive">−₹{salesMetrics.totalDiscounts.toLocaleString("en-IN")}</div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  ₹{salesMetrics.couponDiscounts} coupon · ₹{salesMetrics.loyaltyDiscounts} loyalty
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1.5">
                <CardTitle className="text-xs font-medium text-muted-foreground">Net Sales</CardTitle>
                <CardDescription className="text-[10px]">Gross Sales minus Discounts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-primary">₹{salesMetrics.netSales.toLocaleString("en-IN")}</div>
                <div className="text-[11px] text-muted-foreground mt-1">Shipping: +₹{salesMetrics.shippingRecorded}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1.5">
                <CardTitle className="text-xs font-medium text-muted-foreground">Average Order Value (AOV)</CardTitle>
                <CardDescription className="text-[10px]">Total revenue per paid order</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-foreground">₹{salesMetrics.averageOrderValue.toLocaleString("en-IN")}</div>
                <div className="text-[11px] text-muted-foreground mt-1">Total collected: ₹{salesMetrics.totalRevenue.toLocaleString("en-IN")}</div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" /> Daily Paid Sales (INR)
                </CardTitle>
                <CardDescription className="text-xs">
                  {dateRangeLabel} · Calculated strictly from confirmed and delivered customer payments
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dailyPaidRevenueData.length === 0 ? (
                  <div className="h-56 flex items-center justify-center text-xs text-muted-foreground">
                    No paid orders recorded in this date window.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={230}>
                    <BarChart data={dailyPaidRevenueData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(val: number) => `₹${val.toLocaleString("en-IN")}`} />
                      <Bar dataKey="total" fill="hsl(136, 49%, 16%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-secondary" /> Order Status Distribution
                </CardTitle>
                <CardDescription className="text-xs">{filteredOrders.length} total orders evaluated</CardDescription>
              </CardHeader>
              <CardContent>
                {orderStatusData.length === 0 ? (
                  <div className="h-56 flex items-center justify-center text-xs text-muted-foreground">
                    No orders found.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={230}>
                    <PieChart>
                      <Pie
                        data={orderStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {orderStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                  {orderStatusData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-1 text-[11px]">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="capitalize text-muted-foreground">{d.name} ({d.value})</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
            </>
          )}
        </TabsContent>

        {/* Tab 2: Product Performance */}
        <TabsContent value="products" className="space-y-4">
          {!isAnalyticsEnabled ? (
            <Card className="border-border/60 bg-muted/20">
              <CardContent className="py-16 text-center text-muted-foreground">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50 text-amber-600" />
                <h3 className="font-semibold text-foreground text-sm">Product Performance Reporting is Disabled</h3>
                <p className="text-xs max-w-sm mx-auto mt-1">
                  The Master Administrator has toggled off admin analytics in Feature Controls.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Top Performing Products</h3>
                  <p className="text-xs text-muted-foreground">Based strictly on units sold across confirmed orders</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportProductPerformanceCsv}
                  disabled={!isCsvEnabled}
                  className="h-8 text-xs"
                  title={!isCsvEnabled ? "CSV downloads disabled in Feature Controls" : undefined}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Export Products CSV {!isCsvEnabled && "(Disabled)"}
                </Button>
              </div>

              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12 text-center text-xs">#</TableHead>
                        <TableHead className="text-xs">Product</TableHead>
                        <TableHead className="text-right text-xs">Units Sold</TableHead>
                        <TableHead className="text-right text-xs">Gross Revenue</TableHead>
                        <TableHead className="text-right text-xs">Orders Count</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productPerformance.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-xs text-muted-foreground">
                            No product sales recorded in the selected period.
                          </TableCell>
                        </TableRow>
                      ) : (
                        productPerformance.map((item, index) => (
                          <TableRow key={item.productId}>
                            <TableCell className="text-center font-medium text-xs">{index + 1}</TableCell>
                            <TableCell className="text-xs font-medium text-foreground">{item.productName}</TableCell>
                            <TableCell className="text-right text-xs font-semibold">{item.unitsSold}</TableCell>
                            <TableCell className="text-right text-xs font-semibold">₹{item.grossRevenue.toLocaleString("en-IN")}</TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">{item.ordersCount}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Tab 3: Google & Meta Shopping Feeds */}
        <TabsContent value="discovery" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Evaluated Products</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{feedReport.totalEvaluated}</div>
                <div className="text-[11px] text-muted-foreground mt-1">Catalog items inspected</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Feed-Ready Products</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary flex items-center gap-1.5">
                  <CheckCircle2 className="h-5 w-5 text-primary" /> {feedReport.totalValid}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">Passed all Google & Meta schema validations</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Excluded / Draft Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive flex items-center gap-1.5">
                  <AlertCircle className="h-5 w-5 text-destructive" /> {feedReport.totalExcluded}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">Missing pricing, inactive, or invalid images</div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleDownloadGoogleMerchantXml}
              disabled={!isGmcEnabled}
              className="h-9 text-xs"
              title={!isGmcEnabled ? "Google Merchant feed is disabled in Feature Controls" : undefined}
            >
              <FileCode className="mr-2 h-4 w-4" /> Download Google Merchant XML Feed {!isGmcEnabled && "(Disabled)"}
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadMetaCatalogCsv}
              disabled={!isMetaEnabled}
              className="h-9 text-xs"
              title={!isMetaEnabled ? "Meta catalog feed is disabled in Feature Controls" : undefined}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Download Meta Catalog CSV Feed {!isMetaEnabled && "(Disabled)"}
            </Button>
          </div>

          {feedReport.errors.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" /> Feed Validation Diagnostics
                </CardTitle>
                <CardDescription className="text-xs">
                  The following products cannot be published to merchant feeds until issues are resolved:
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Product Name</TableHead>
                      <TableHead className="text-xs">Product ID</TableHead>
                      <TableHead className="text-xs">Validation Errors</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feedReport.errors.map((err) => (
                      <TableRow key={err.productId}>
                        <TableCell className="text-xs font-medium">{err.productName}</TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{err.productId}</TableCell>
                        <TableCell className="text-xs text-destructive">
                          {err.issues.join("; ")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab 4: Integration Status & Technical Foundations */}
        <TabsContent value="integrations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" /> Architecture & Integration Truth Report
              </CardTitle>
              <CardDescription className="text-xs">
                Audited source-of-truth status across payment, logistics, tax, and recurring billing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="p-3 border rounded-lg bg-muted/40 space-y-1">
                <div className="font-semibold text-foreground flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" /> Razorpay Payment Verification
                </div>
                <p className="text-muted-foreground">
                  Active & verified via HMAC-SHA256 Web Crypto signature verification in <code>verify-razorpay-payment</code>.
                  Orders transition to <code>confirmed</code> only when signature matches.
                </p>
              </div>

              <div className="p-3 border rounded-lg bg-muted/40 space-y-1">
                <div className="font-semibold text-foreground flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600" /> Automated Shipping Carrier (Delhivery / Shiprocket)
                </div>
                <p className="text-muted-foreground">
                  Missing carrier webhook & API keys. Delivery tracking is managed manually via the CMS Deliveries module.
                  Carrier tracking, delay flags, and delivery attempt counters require active logistics API integration.
                </p>
              </div>

              <div className="p-3 border rounded-lg bg-muted/40 space-y-1">
                <div className="font-semibold text-foreground flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600" /> Automated Refunds & Returns
                </div>
                <p className="text-muted-foreground">
                  The current database records order statuses <code>pending, confirmed, shipped, delivered, cancelled</code>.
                  Returns are manually logged in the Deliveries table. Automated financial refund reconciliation requires
                  configuring the Razorpay Refund webhook.
                </p>
              </div>

              <div className="p-3 border rounded-lg bg-muted/40 space-y-1">
                <div className="font-semibold text-foreground flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" /> Product Subscriptions & Replenishment
                </div>
                <p className="text-muted-foreground">
                  Database schema supports <code>public.subscriptions</code> with cadence intervals (15, 30, 60, 90 days).
                  Subscriptions are recorded for customer replenishment reminders. Automatic recurring card charge execution
                  requires enabling Razorpay Subscriptions billing.
                </p>
              </div>

              <div className="p-3 border rounded-lg bg-muted/40 space-y-1">
                <div className="font-semibold text-foreground flex items-center gap-2">
                  <Info className="h-4 w-4 text-primary" /> Indian GST Tax Accounting
                </div>
                <p className="text-muted-foreground">
                  Product catalog prices are GST-inclusive in accordance with standard Indian retail superfoods requirements.
                  No separate tax surcharge column is added to order subtotals.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminAnalytics;
