import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ShoppingCart, DollarSign, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";

const AdminDashboard = () => {
  const [stats, setStats] = useState({ products: 0, orders: 0, revenue: 0, pending: 0 });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const [{ count: prodCount }, { data: orders }] = await Promise.all([
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(10),
      ]);
      const allOrders = orders || [];
      const revenue = allOrders.reduce((s, o) => s + Number(o.total), 0);
      const pending = allOrders.filter((o) => o.status === "pending").length;
      setStats({ products: prodCount || 0, orders: allOrders.length, revenue, pending });
      setRecentOrders(allOrders.slice(0, 5));
    };
    load();
  }, []);

  const cards = [
    { label: "Products", value: stats.products, icon: Package, color: "text-secondary" },
    { label: "Total Orders", value: stats.orders, icon: ShoppingCart, color: "text-primary" },
    { label: "Revenue", value: `₹${stats.revenue.toFixed(0)}`, icon: DollarSign, color: "text-accent-foreground" },
    { label: "Pending", value: stats.pending, icon: TrendingUp, color: "text-destructive" },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-heading font-bold text-foreground">Dashboard Overview</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className={`h-5 w-5 ${c.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((o) => (
                <div key={o.id} className="flex items-center justify-between text-sm border-b border-border pb-2">
                  <div>
                    <span className="font-mono text-xs text-muted-foreground">{o.id.slice(0, 8)}...</span>
                    <span className="ml-3 capitalize font-medium">{o.status}</span>
                  </div>
                  <span className="font-semibold">₹{Number(o.total).toFixed(0)}</span>
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
