import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, MapPin, Search } from "lucide-react";

const emptyForm = { pincode: "", city: "", state: "", estimated_days: "5", cod_available: true };

const AdminPincodes = () => {
  const [items, setItems] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const fetchData = async () => {
    const { data } = await supabase.from("serviceable_pincodes").select("*").order("pincode").limit(500);
    setItems(data || []);
  };
  useEffect(() => { fetchData(); }, []);

  const openNew = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (p: any) => {
    setEditId(p.id);
    setForm({ pincode: p.pincode, city: p.city || "", state: p.state || "", estimated_days: String(p.estimated_days || 5), cod_available: p.cod_available ?? true });
    setDialogOpen(true);
  };

  const save = async () => {
    const payload = { pincode: form.pincode, city: form.city || null, state: form.state || null, estimated_days: parseInt(form.estimated_days) || 5, cod_available: form.cod_available };
    if (editId) {
      await supabase.from("serviceable_pincodes").update(payload).eq("id", editId);
      toast({ title: "Pincode updated" });
    } else {
      await supabase.from("serviceable_pincodes").insert(payload);
      toast({ title: "Pincode added" });
    }
    setDialogOpen(false);
    fetchData();
  };

  const del = async (id: string) => {
    if (!confirm("Remove this pincode?")) return;
    await supabase.from("serviceable_pincodes").delete().eq("id", id);
    toast({ title: "Pincode removed" });
    fetchData();
  };

  const filtered = search ? items.filter(p => p.pincode.includes(search) || (p.city || "").toLowerCase().includes(search.toLowerCase())) : items;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MapPin className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-heading font-bold text-foreground">Serviceable Pincodes</h2>
        </div>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Add Pincode</Button>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search pincode or city..." className="pl-10" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Pincode</TableHead><TableHead>City</TableHead><TableHead>State</TableHead><TableHead>Est. Days</TableHead><TableHead>COD</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No pincodes found</TableCell></TableRow>
              )}
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono font-medium">{p.pincode}</TableCell>
                  <TableCell>{p.city || "—"}</TableCell>
                  <TableCell>{p.state || "—"}</TableCell>
                  <TableCell>{p.estimated_days} days</TableCell>
                  <TableCell>{p.cod_available ? "✅" : "❌"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => del(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editId ? "Edit" : "Add"} Pincode</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Pincode</Label><Input value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} maxLength={6} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
              <div><Label>State</Label><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
            </div>
            <div><Label>Estimated Delivery Days</Label><Input type="number" value={form.estimated_days} onChange={(e) => setForm({ ...form, estimated_days: e.target.value })} /></div>
            <label className="flex items-center gap-2 text-sm"><Switch checked={form.cod_available} onCheckedChange={(v) => setForm({ ...form, cod_available: v })} /> COD Available</label>
            <Button onClick={save} className="w-full">{editId ? "Update" : "Add"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPincodes;
