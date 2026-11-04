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
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

const emptyForm = { pincode: "", city: "", state: "", estimated_days: "5", cod_available: true };

const AdminPincodes = () => {
  const [items, setItems] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
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
    const cleanPincode = form.pincode.trim();
    if (!/^\d{6}$/.test(cleanPincode)) {
      toast({ title: "Invalid Pincode", description: "Pincode must be exactly 6 digits", variant: "destructive" });
      return;
    }
    const days = parseInt(form.estimated_days, 10);
    if (isNaN(days) || days < 1) {
      toast({ title: "Invalid Estimated Days", description: "Estimated delivery days must be 1 or more", variant: "destructive" });
      return;
    }

    setSaving(true);
    const payload = {
      pincode: cleanPincode,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      estimated_days: days,
      cod_available: form.cod_available,
    };

    if (editId) {
      const { error } = await supabase.from("serviceable_pincodes").update(payload).eq("id", editId);
      setSaving(false);
      if (error) {
        toast({ title: "Error updating pincode", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Pincode updated" });
    } else {
      const { error } = await supabase.from("serviceable_pincodes").insert(payload);
      setSaving(false);
      if (error) {
        toast({ title: "Error adding pincode", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Pincode added" });
    }
    setDialogOpen(false);
    fetchData();
  };

  const confirmDeletePincode = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    const { error } = await supabase.from("serviceable_pincodes").delete().eq("id", deleteTargetId);
    setIsDeleting(false);
    setDeleteTargetId(null);
    if (error) {
      toast({ title: "Error removing pincode", description: error.message, variant: "destructive" });
      return;
    }
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
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTargetId(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
            <Button onClick={save} disabled={saving} className="w-full">
              {saving ? "Saving..." : editId ? "Update" : "Add"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTargetId}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
        title="Remove Pincode"
        description="Are you sure you want to remove this serviceable pincode? Customers in this area will no longer see delivery availability."
        confirmText="Remove Pincode"
        loading={isDeleting}
        onConfirm={confirmDeletePincode}
      />
    </div>
  );
};

export default AdminPincodes;
