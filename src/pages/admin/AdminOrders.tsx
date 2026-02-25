import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const statuses = ["pending", "confirmed", "shipped", "delivered", "cancelled"];

const AdminOrders = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const { toast } = useToast();

  const fetchOrders = async () => {
    const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    setOrders(data || []);
  };

  useEffect(() => { fetchOrders(); }, []);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("orders").update({ status }).eq("id", id);
    toast({ title: `Order updated to ${status}` });
    fetchOrders();
  };

  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-heading font-bold text-foreground">Orders</h2>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Orders</SelectItem>
            {statuses.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Update</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">{o.id.slice(0, 8)}...</TableCell>
                  <TableCell className="text-sm">{format(new Date(o.created_at), "MMM dd, yyyy")}</TableCell>
                  <TableCell className="font-semibold">₹{Number(o.total).toFixed(0)}</TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${
                      o.status === "confirmed" ? "bg-secondary/20 text-secondary" :
                      o.status === "shipped" ? "bg-accent/30 text-accent-foreground" :
                      o.status === "delivered" ? "bg-primary/20 text-primary" :
                      o.status === "cancelled" ? "bg-destructive/20 text-destructive" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {o.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Select value={o.status} onValueChange={(v) => updateStatus(o.id, v)}>
                      <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {statuses.map((s) => <SelectItem key={s} value={s} className="capitalize text-xs">{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No orders found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminOrders;
