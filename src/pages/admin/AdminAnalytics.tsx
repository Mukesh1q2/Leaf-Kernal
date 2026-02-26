import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["hsl(150, 40%, 18%)", "hsl(90, 30%, 45%)", "hsl(38, 40%, 70%)", "hsl(0, 84%, 60%)", "hsl(220, 60%, 50%)"];

const AdminAnalytics = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const [{ data: o }, { data: p }] = await Promise.all([
        supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("products").select("id, name, price, stock_quantity, review_count"),
      ]);
      setOrders(o || []);
      setProducts(p || []);
    };
    load();
  }, []);

  const totalRevenue = orders.reduce((s, o) => s + Number(o.total), 0);
  const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;

  // Revenue by day
  const dayMap: Record<string, number> = {};
  orders.forEach(o => {
    const day = new Date(o.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
    dayMap[day] = (dayMap[day] || 0) + Number(o.total);
  });
  const revenueByDay = Object.entries(dayMap).map(([day, total]) => ({ day, total })).slice(0, 14).reverse();

  // Orders by status
  const statusMap: Record<string, number> = {};
  orders.forEach(o => { statusMap[o.status] = (statusMap[o.status] || 0) + 1; });
  const ordersByStatus = Object.entries(statusMap).map(([name, value]) => ({ name, value }));

  // Top products by review count
  const topByReviews = [...products].sort((a, b) => (b.review_count || 0) - (a.review_count || 0)).slice(0, 5)
    .map(p => ({ name: p.name.length > 18 ? p.name.slice(0, 18) + "…" : p.name, reviews: p.review_count || 0 }));

  const exportOrders = () => {
    const headers = "Order ID,Date,Status,Total\n";
    const rows = orders.map(o => `${o.id},"${new Date(o.created_at).toLocaleDateString()}",${o.status},${o.total}`).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "orders-report.csv"; a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-heading font-bold text-foreground">Analytics & Reports</h2>
        <Button variant="outline" size="sm" onClick={exportOrders}><Download className="mr-2 h-4 w-4" /> Export Orders CSV</Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Revenue</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">₹{totalRevenue.toLocaleString("en-IN")}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Orders</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{orders.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Avg Order Value</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">₹{avgOrderValue.toFixed(0)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Products</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{products.length}</div></CardContent></Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Revenue by Day</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={revenueByDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
                <Bar dataKey="total" fill="hsl(150, 40%, 18%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

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

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-sm">Top Products by Reviews</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topByReviews} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="reviews" fill="hsl(90, 30%, 45%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminAnalytics;
