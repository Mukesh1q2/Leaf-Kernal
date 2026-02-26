import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Star } from "lucide-react";

const emptyForm = { name: "", city: "", product: "", quote: "", photo_url: "", rating: "5", sort_order: "0", is_active: true };

const AdminTestimonials = () => {
  const [items, setItems] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const { toast } = useToast();

  const fetchData = async () => {
    const { data } = await supabase.from("testimonials").select("*").order("sort_order");
    setItems(data || []);
  };

  useEffect(() => { fetchData(); }, []);

  const openNew = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (t: any) => {
    setEditId(t.id);
    setForm({
      name: t.name, city: t.city || "", product: t.product || "", quote: t.quote,
      photo_url: t.photo_url || "", rating: String(t.rating || 5),
      sort_order: String(t.sort_order || 0), is_active: t.is_active,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    const payload = {
      name: form.name, city: form.city || null, product: form.product || null,
      quote: form.quote, photo_url: form.photo_url || null,
      rating: parseInt(form.rating) || 5, sort_order: parseInt(form.sort_order) || 0,
      is_active: form.is_active,
    };
    if (editId) {
      await supabase.from("testimonials").update(payload).eq("id", editId);
      toast({ title: "Testimonial updated" });
    } else {
      await supabase.from("testimonials").insert(payload);
      toast({ title: "Testimonial created" });
    }
    setDialogOpen(false);
    fetchData();
  };

  const deleteItem = async (id: string) => {
    if (!confirm("Delete this testimonial?")) return;
    await supabase.from("testimonials").delete().eq("id", id);
    toast({ title: "Testimonial deleted" });
    fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-heading font-bold text-foreground">Testimonials</h2>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Add Testimonial</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Quote</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No testimonials</TableCell></TableRow>
              )}
              {items.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-sm">{t.city || "—"}</TableCell>
                  <TableCell className="text-sm">{t.product || "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-0.5">
                      {[...Array(t.rating || 5)].map((_, i) => <Star key={i} size={12} className="fill-yellow-500 text-yellow-500" />)}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm max-w-xs truncate">{t.quote}</TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${t.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {t.is_active ? "Active" : "Hidden"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteItem(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
          <DialogHeader><DialogTitle>{editId ? "Edit" : "New"} Testimonial</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            </div>
            <div><Label>Product</Label><Input value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} /></div>
            <div><Label>Quote</Label><Textarea value={form.quote} onChange={(e) => setForm({ ...form, quote: e.target.value })} rows={3} /></div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Rating</Label><Input type="number" min="1" max="5" value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} /></div>
              <div><Label>Sort Order</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} /></div>
              <div className="flex items-end pb-2"><label className="flex items-center gap-2 text-sm"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /> Active</label></div>
            </div>
            <Button onClick={save} className="w-full">{editId ? "Update" : "Create"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTestimonials;
