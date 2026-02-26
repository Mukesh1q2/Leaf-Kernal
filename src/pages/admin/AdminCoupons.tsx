import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Copy } from "lucide-react";

const emptyForm = {
  code: "", discount_type: "percentage", discount_value: "", min_order_value: "",
  max_uses: "", per_customer_limit: "1", valid_from: "", valid_to: "",
  is_active: true, first_order_only: false,
};

const AdminCoupons = () => {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const { toast } = useToast();

  const fetchCoupons = async () => {
    const { data } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
    setCoupons(data || []);
  };

  useEffect(() => { fetchCoupons(); }, []);

  const openNew = () => {
    setEditId(null);
    setForm({ ...emptyForm, code: "LK" + Math.random().toString(36).substring(2, 8).toUpperCase() });
    setDialogOpen(true);
  };

  const openEdit = (c: any) => {
    setEditId(c.id);
    setForm({
      code: c.code, discount_type: c.discount_type, discount_value: String(c.discount_value),
      min_order_value: c.min_order_value ? String(c.min_order_value) : "",
      max_uses: c.max_uses ? String(c.max_uses) : "",
      per_customer_limit: String(c.per_customer_limit || 1),
      valid_from: c.valid_from ? c.valid_from.slice(0, 16) : "",
      valid_to: c.valid_to ? c.valid_to.slice(0, 16) : "",
      is_active: c.is_active, first_order_only: c.first_order_only,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    const payload = {
      code: form.code.toUpperCase(),
      discount_type: form.discount_type,
      discount_value: parseFloat(form.discount_value) || 0,
      min_order_value: form.min_order_value ? parseFloat(form.min_order_value) : 0,
      max_uses: form.max_uses ? parseInt(form.max_uses) : null,
      per_customer_limit: parseInt(form.per_customer_limit) || 1,
      valid_from: form.valid_from || new Date().toISOString(),
      valid_to: form.valid_to || null,
      is_active: form.is_active,
      first_order_only: form.first_order_only,
    };
    if (editId) {
      await supabase.from("coupons").update(payload).eq("id", editId);
      toast({ title: "Coupon updated" });
    } else {
      await supabase.from("coupons").insert(payload);
      toast({ title: "Coupon created" });
    }
    setDialogOpen(false);
    fetchCoupons();
  };

  const deleteCoupon = async (id: string) => {
    if (!confirm("Delete this coupon?")) return;
    await supabase.from("coupons").delete().eq("id", id);
    toast({ title: "Coupon deleted" });
    fetchCoupons();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-heading font-bold text-foreground">Coupons</h2>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Create Coupon</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Min Order</TableHead>
                <TableHead>Uses</TableHead>
                <TableHead>Valid Until</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No coupons yet</TableCell></TableRow>
              )}
              {coupons.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm">{c.code}</span>
                      <button onClick={() => { navigator.clipboard.writeText(c.code); toast({ title: "Copied!" }); }}>
                        <Copy className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>
                    {c.discount_type === "percentage" ? `${c.discount_value}%` :
                     c.discount_type === "fixed" ? `₹${c.discount_value}` : "Free Shipping"}
                  </TableCell>
                  <TableCell>₹{c.min_order_value || 0}</TableCell>
                  <TableCell>{c.used_count}/{c.max_uses || "∞"}</TableCell>
                  <TableCell className="text-sm">{c.valid_to ? new Date(c.valid_to).toLocaleDateString() : "No expiry"}</TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${c.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {c.is_active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteCoupon(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? "Edit Coupon" : "Create Coupon"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Discount Type</Label>
                <Select value={form.discount_type} onValueChange={(v) => setForm({ ...form, discount_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                    <SelectItem value="free_shipping">Free Shipping</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Discount Value</Label><Input type="number" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Min Order (₹)</Label><Input type="number" value={form.min_order_value} onChange={(e) => setForm({ ...form, min_order_value: e.target.value })} /></div>
              <div><Label>Max Uses</Label><Input type="number" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} placeholder="Unlimited" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Valid From</Label><Input type="datetime-local" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} /></div>
              <div><Label>Valid Until</Label><Input type="datetime-local" value={form.valid_to} onChange={(e) => setForm({ ...form, valid_to: e.target.value })} /></div>
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /> Active</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.first_order_only} onCheckedChange={(v) => setForm({ ...form, first_order_only: v })} /> First Order Only</label>
            </div>
            <Button onClick={save} className="w-full">{editId ? "Update" : "Create"} Coupon</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCoupons;
