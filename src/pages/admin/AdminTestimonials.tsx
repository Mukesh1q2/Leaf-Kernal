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
import { Plus, Pencil, Trash2, Star, Loader2, CheckCircle2 } from "lucide-react";
import ImageUpload from "@/components/admin/ImageUpload";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

const emptyForm = { name: "", city: "", product: "", quote: "", photo_url: "", rating: "5", sort_order: "0", is_active: true, is_verified: false };

const AdminTestimonials = () => {
  const [items, setItems] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; testimonialId: string | null; customerName: string }>({
    open: false,
    testimonialId: null,
    customerName: "",
  });
  const { toast } = useToast();

  const fetchData = async () => {
    const { data, error } = await supabase.from("testimonials").select("*").order("sort_order");
    if (error) {
      toast({ title: "Failed to load testimonials", description: error.message, variant: "destructive" });
    } else {
      setItems(data || []);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openNew = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (t: any) => {
    setEditId(t.id);
    setForm({
      name: t.name,
      city: t.city || "",
      product: t.product || "",
      quote: t.quote,
      photo_url: t.photo_url || "",
      rating: String(t.rating || 5),
      sort_order: String(t.sort_order || 0),
      is_active: t.is_active ?? true,
      is_verified: t.is_verified ?? false,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast({ title: "Customer name required", description: "Please enter the customer's name.", variant: "destructive" });
      return;
    }
    if (!form.quote.trim()) {
      toast({ title: "Quote required", description: "Please enter the genuine customer quote.", variant: "destructive" });
      return;
    }

    const ratingNum = parseInt(form.rating, 10);
    const validRating = isNaN(ratingNum) ? 5 : Math.max(1, Math.min(5, ratingNum));
    const sortOrder = parseInt(form.sort_order, 10);

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      city: form.city?.trim() || null,
      product: form.product?.trim() || null,
      quote: form.quote.trim(),
      photo_url: form.photo_url?.trim() || null,
      rating: validRating,
      sort_order: isNaN(sortOrder) ? 0 : sortOrder,
      is_active: form.is_active,
      is_verified: form.is_verified,
    };

    if (editId) {
      const { error } = await supabase.from("testimonials").update(payload).eq("id", editId);
      if (error) {
        setSaving(false);
        toast({ title: "Failed to update testimonial", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Testimonial updated successfully" });
    } else {
      const { error } = await supabase.from("testimonials").insert(payload);
      if (error) {
        setSaving(false);
        toast({ title: "Failed to create testimonial", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Testimonial created successfully" });
    }

    setSaving(false);
    setDialogOpen(false);
    fetchData();
  };

  const promptDeleteItem = (t: any) => {
    setDeleteDialog({
      open: true,
      testimonialId: t.id,
      customerName: t.name,
    });
  };

  const confirmDeleteItem = async () => {
    if (!deleteDialog.testimonialId) return;
    setIsDeleting(true);

    const { error } = await supabase.from("testimonials").delete().eq("id", deleteDialog.testimonialId);
    setIsDeleting(false);
    setDeleteDialog(prev => ({ ...prev, open: false }));

    if (error) {
      toast({ title: "Failed to delete testimonial", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Testimonial deleted successfully" });
      fetchData();
    }
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
                <TableHead>Verified</TableHead>
                <TableHead>Quote</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No testimonials yet</TableCell></TableRow>
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
                  <TableCell>
                    {t.is_verified ? (
                      <span className="inline-flex items-center gap-1 text-xs text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-full">
                        <CheckCircle2 size={12} /> Verified
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Standard</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm max-w-xs truncate">{t.quote}</TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${t.is_active ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"}`}>
                      {t.is_active ? "Active" : "Hidden"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => promptDeleteItem(t)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
              <div><Label>Customer Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Priya Sharma" /></div>
              <div><Label>City / State</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="e.g. Mumbai, MH" /></div>
            </div>
            <div><Label>Product Used</Label><Input value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} placeholder="e.g. Ashwagandha Root Capsules" /></div>
            <div><Label>Customer Quote</Label><Textarea value={form.quote} onChange={(e) => setForm({ ...form, quote: e.target.value })} rows={3} placeholder="The product has helped my evening routine tremendously..." /></div>
            <div><Label>Customer Photo (optional)</Label><ImageUpload value={form.photo_url} onChange={(url) => setForm({ ...form, photo_url: url })} folder="testimonials" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Rating (1–5)</Label><Input type="number" min="1" max="5" value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} /></div>
              <div><Label>Sort Order</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} /></div>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/40">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <Switch checked={form.is_verified} onCheckedChange={(v) => setForm({ ...form, is_verified: v })} />
                <span>Verified Buyer / Customer</span>
              </label>
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <span>Active (Public)</span>
              </label>
            </div>
            <Button onClick={save} disabled={saving} className="w-full">
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : editId ? "Update Testimonial" : "Create Testimonial"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}
        title="Delete Testimonial"
        description={`Are you sure you want to delete the testimonial from "${deleteDialog.customerName}"? This action cannot be undone.`}
        confirmText="Delete Testimonial"
        loading={isDeleting}
        onConfirm={confirmDeleteItem}
      />
    </div>
  );
};

export default AdminTestimonials;
