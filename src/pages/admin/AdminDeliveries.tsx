import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";

const STATUSES = ["placed", "packed", "shipped", "out_for_delivery", "delivered", "returned"];

const AdminDeliveries = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({ tracking_id: "", carrier: "", status: "placed", estimated_delivery: "" });

  const load = async () => {
    const { data: o } = await supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(200);
    const { data: d } = await (supabase.from("deliveries" as any) as any).select("*");
    const dmap = new Map((d || []).map((x: any) => [x.order_id, x]));
    setOrders((o || []).map((x: any) => ({ ...x, delivery: dmap.get(x.id) })));
  };
  useEffect(() => { load(); }, []);

  const openEdit = (order: any) => {
    setEditing(order);
    const d = order.delivery || {};
    setForm({
      tracking_id: d.tracking_id || "",
      carrier: d.carrier || "",
      status: d.status || "placed",
      estimated_delivery: d.estimated_delivery || "",
    });
  };

  const save = async () => {
    if (!editing) return;
    const payload: any = {
      order_id: editing.id,
      tracking_id: form.tracking_id || null,
      carrier: form.carrier || null,
      status: form.status,
      estimated_delivery: form.estimated_delivery || null,
    };
    if (editing.delivery) {
      const { error } = await (supabase.from("deliveries" as any) as any).update(payload).eq("id", editing.delivery.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await (supabase.from("deliveries" as any) as any).insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success("Delivery updated — customer notified");
    setEditing(null);
    load();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-heading font-bold">Delivery Management</h2>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Order</TableHead><TableHead>Date</TableHead><TableHead>Tracking</TableHead>
            <TableHead>Carrier</TableHead><TableHead>Status</TableHead><TableHead>ETA</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {orders.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-mono text-xs">{o.id.slice(0, 8)}</TableCell>
                <TableCell className="text-xs">{format(new Date(o.created_at), "MMM dd")}</TableCell>
                <TableCell className="text-xs">{o.delivery?.tracking_id || "—"}</TableCell>
                <TableCell className="text-xs">{o.delivery?.carrier || "—"}</TableCell>
                <TableCell className="text-xs capitalize">{(o.delivery?.status || "—").replace(/_/g, " ")}</TableCell>
                <TableCell className="text-xs">{o.delivery?.estimated_delivery ? format(new Date(o.delivery.estimated_delivery), "MMM dd") : "—"}</TableCell>
                <TableCell><Button size="sm" variant="outline" onClick={() => openEdit(o)}>Manage</Button></TableCell>
              </TableRow>
            ))}
            {orders.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No orders</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update Delivery</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Tracking ID</Label><Input value={form.tracking_id} onChange={(e) => setForm({ ...form, tracking_id: e.target.value })} /></div>
            <div><Label>Carrier</Label><Input value={form.carrier} onChange={(e) => setForm({ ...form, carrier: e.target.value })} placeholder="Delhivery, Shiprocket…" /></div>
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Estimated Delivery</Label><Input type="date" value={form.estimated_delivery} onChange={(e) => setForm({ ...form, estimated_delivery: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDeliveries;