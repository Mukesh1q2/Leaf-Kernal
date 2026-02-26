import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Users, Search, Download } from "lucide-react";

interface CustomerData {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  order_count: number;
  total_spent: number;
  last_order: string | null;
}

const AdminCustomers = () => {
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      // Get profiles
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, phone");
      // Get orders grouped by user
      const { data: orders } = await supabase.from("orders").select("user_id, total, created_at").order("created_at", { ascending: false });

      const orderMap: Record<string, { count: number; spent: number; lastOrder: string | null }> = {};
      (orders || []).forEach(o => {
        if (!orderMap[o.user_id]) orderMap[o.user_id] = { count: 0, spent: 0, lastOrder: null };
        orderMap[o.user_id].count++;
        orderMap[o.user_id].spent += Number(o.total);
        if (!orderMap[o.user_id].lastOrder) orderMap[o.user_id].lastOrder = o.created_at;
      });

      const customerList: CustomerData[] = (profiles || []).map(p => ({
        user_id: p.user_id,
        full_name: p.full_name,
        phone: p.phone,
        order_count: orderMap[p.user_id]?.count || 0,
        total_spent: orderMap[p.user_id]?.spent || 0,
        last_order: orderMap[p.user_id]?.lastOrder || null,
      }));

      // Sort by total spent descending
      customerList.sort((a, b) => b.total_spent - a.total_spent);
      setCustomers(customerList);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = search
    ? customers.filter(c => (c.full_name || "").toLowerCase().includes(search.toLowerCase()) || (c.phone || "").includes(search))
    : customers;

  const exportCSV = () => {
    const headers = "Name,Phone,Orders,Total Spent,Last Order\n";
    const rows = filtered.map(c =>
      `"${c.full_name || ""}","${c.phone || ""}",${c.order_count},${c.total_spent},"${c.last_order ? new Date(c.last_order).toLocaleDateString() : ""}"`
    ).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "customers.csv"; a.click();
  };

  const getSegment = (c: CustomerData) => {
    if (c.order_count === 0) return { label: "No Orders", cls: "bg-muted text-muted-foreground" };
    if (c.total_spent > 5000) return { label: "High Value", cls: "bg-green-100 text-green-800" };
    if (c.order_count > 3) return { label: "Repeat", cls: "bg-blue-100 text-blue-800" };
    if (c.order_count === 1) return { label: "First-Time", cls: "bg-yellow-100 text-yellow-800" };
    return { label: "Regular", cls: "bg-purple-100 text-purple-800" };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-heading font-bold text-foreground">Customers</h2>
        <Button variant="outline" size="sm" onClick={exportCSV}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Customers</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold">{customers.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">With Orders</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold">{customers.filter(c => c.order_count > 0).length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">High Value</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold">{customers.filter(c => c.total_spent > 5000).length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Repeat Buyers</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold">{customers.filter(c => c.order_count > 1).length}</div></CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or phone..." className="pl-10" />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Total Spent</TableHead>
                <TableHead>Last Order</TableHead>
                <TableHead>Segment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No customers found</TableCell></TableRow>
              ) : filtered.map((c) => {
                const seg = getSegment(c);
                return (
                  <TableRow key={c.user_id}>
                    <TableCell className="font-medium">{c.full_name || "—"}</TableCell>
                    <TableCell className="text-sm">{c.phone || "—"}</TableCell>
                    <TableCell>{c.order_count}</TableCell>
                    <TableCell className="font-semibold">₹{c.total_spent.toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-sm">{c.last_order ? new Date(c.last_order).toLocaleDateString() : "—"}</TableCell>
                    <TableCell><span className={`text-xs font-medium px-2 py-1 rounded-full ${seg.cls}`}>{seg.label}</span></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminCustomers;
