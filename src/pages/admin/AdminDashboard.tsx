import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ShoppingCart, DollarSign, TrendingUp, Users, Star, AlertTriangle, Gift } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

const COLORS = ["hsl(150, 40%, 18%)", "hsl(90, 30%, 45%)", "hsl(38, 40%, 70%)", "hsl(0, 84%, 60%)", "hsl(220, 60%, 50%)"];

const AdminDashboard = () => {
  const [stats, setStats] = useState({ products: 0, orders: 0, revenue: 0, pending: 0, customers: 0, reviews: 0, lowStock: 0, coupons: 0 });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [ordersByStatus, setOrdersByStatus] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const [{ count: prodCount }, { data: orders }, { data: products }, { count: reviewCount }, { count: couponCount }] = await Promise.all([
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("products").select("id, name, price, stock_quantity, image_url").order("review_count", { ascending: false }).limit(5),
        supabase.from("reviews").select("*", { count: "exact", head: true }).eq("is_approved", false),
        supabase.from("coupons").select("*", { count: "exact", head: true }).eq("is_active", true),
      ]);

      const allOrders = orders || [];
      const revenue = allOrders.reduce((s, o) => s + Number(o.total), 0);
      const pending = allOrders.filter((o) => o.status === "pending").length;
      const lowStock = (products || []).filter(p => (p.stock_quantity || 0) < 10).length;

      // Unique customer count from orders
      const uniqueCustomers = new Set(allOrders.map(o => o.user_id)).size;

      setStats({
        products: prodCount || 0,
        orders: allOrders.length,
        revenue,
        pending,
        customers: uniqueCustomers,
        reviews: reviewCount || 0,
        lowStock,
        coupons: couponCount || 0,
      });
      setRecentOrders(allOrders.slice(0, 5));

      // Orders by status for pie chart
      const statusMap: Record<string, number> = {};
      allOrders.forEach(o => { statusMap[o.status] = (statusMap[o.status] || 0) + 1; });
      setOrdersByStatus(Object.entries(statusMap).map(([name, value]) => ({ name, value })));

      // Top products for bar chart
      setTopProducts((products || []).map(p => ({ name: p.name.length > 15 ? p.name.slice(0, 15) + "…" : p.name, price: p.price })));

      // Revenue by day (last 7 orders grouped)
      const last7 = allOrders.slice(0, 30);
      const dayMap: Record<string, number> = {};
      last7.forEach(o => {
        const day = new Date(o.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
        dayMap[day] = (dayMap[day] || 0) + Number(o.total);
      });
      setRevenueData(Object.entries(dayMap).map(([day, total]) => ({ day, total })).reverse());
    };
    load();
  }, []);

  const cards = [
    { label: "Products", value: stats.products, icon: Package, color: "text-secondary", link: "/admin/products" },
    { label: "Total Orders", value: stats.orders, icon: ShoppingCart, color: "text-primary", link: "/admin/orders" },
    { label: "Revenue", value: `₹${stats.revenue.toLocaleString("en-IN")}`, icon: DollarSign, color: "text-accent-foreground", link: "/admin/orders" },
    { label: "Pending", value: stats.pending, icon: TrendingUp, color: "text-destructive", link: "/admin/orders" },
    { label: "Customers", value: stats.customers, icon: Users, color: "text-primary", link: "/admin/customers" },
    { label: "Pending Reviews", value: stats.reviews, icon: Star, color: "text-accent-foreground", link: "/admin/reviews" },
    { label: "Low Stock", value: stats.lowStock, icon: AlertTriangle, color: "text-destructive", link: "/admin/inventory" },
    { label: "Active Coupons", value: stats.coupons, icon: Gift, color: "text-secondary", link: "/admin/coupons" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-heading font-bold text-foreground">Dashboard Overview</h2>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link to={c.link} key={c.label}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">{c.label}</CardTitle>
                <c.icon className={`h-4 w-4 ${c.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-foreground">{c.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Trend */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-sm">Revenue Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
                <Line type="monotone" dataKey="total" stroke="hsl(150, 40%, 18%)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Orders by Status */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Orders by Status</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={ordersByStatus} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {ordersByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Products + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Top Products</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topProducts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `₹${v}`} />
                <Bar dataKey="price" fill="hsl(90, 30%, 45%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Quick Actions</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" asChild><Link to="/admin/products">+ Add Product</Link></Button>
            <Button variant="outline" size="sm" asChild><Link to="/admin/blog">+ Write Blog Post</Link></Button>
            <Button variant="outline" size="sm" asChild><Link to="/admin/banners">Update Banners</Link></Button>
            <Button variant="outline" size="sm" asChild><Link to="/admin/orders">View Orders</Link></Button>
            <Button variant="outline" size="sm" asChild><Link to="/admin/inventory">Low Stock Alerts</Link></Button>
            <Button variant="outline" size="sm" asChild><Link to="/admin/coupons">Manage Coupons</Link></Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Recent Orders</CardTitle></CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((o) => (
                <div key={o.id} className="flex items-center justify-between text-sm border-b border-border pb-2">
                  <div>
                    <span className="font-mono text-xs text-muted-foreground">{o.id.slice(0, 8)}...</span>
                    <span className={`ml-3 capitalize font-medium px-2 py-0.5 rounded-full text-xs ${
                      o.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                      o.status === "confirmed" ? "bg-blue-100 text-blue-800" :
                      o.status === "shipped" ? "bg-purple-100 text-purple-800" :
                      o.status === "delivered" ? "bg-green-100 text-green-800" :
                      "bg-red-100 text-red-800"
                    }`}>{o.status}</span>
                  </div>
                  <span className="font-semibold">₹{Number(o.total).toLocaleString("en-IN")}</span>
                </div>
              ))}
              <Link to="/admin/orders" className="text-sm text-secondary hover:underline">View all orders →</Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
