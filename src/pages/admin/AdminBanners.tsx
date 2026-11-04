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
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import ImageUpload from "@/components/admin/ImageUpload";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

const emptyForm = {
  title: "", subtitle: "", image_url: "", cta_text: "Shop Now", cta_link: "/shop",
  bg_color: "#1A4D2E", position: "hero", sort_order: "0", is_active: true,
  starts_at: "", ends_at: "",
};

const AdminBanners = () => {
  const [banners, setBanners] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; bannerId: string | null; bannerTitle: string }>({
    open: false,
    bannerId: null,
    bannerTitle: "",
  });
  const { toast } = useToast();

  const fetch = async () => {
    const { data, error } = await supabase.from("banners").select("*").order("sort_order");
    if (error) {
      toast({ title: "Failed to load banners", description: error.message, variant: "destructive" });
    } else {
      setBanners(data || []);
    }
  };

  useEffect(() => { fetch(); }, []);

  const openNew = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (b: any) => {
    setEditId(b.id);
    setForm({
      title: b.title,
      subtitle: b.subtitle || "",
      image_url: b.image_url || "",
      cta_text: b.cta_text || "Shop Now",
      cta_link: b.cta_link || "/shop",
      bg_color: b.bg_color || "#1A4D2E",
      position: b.position,
      sort_order: String(b.sort_order || 0),
      is_active: b.is_active ?? true,
      starts_at: b.starts_at ? new Date(b.starts_at).toISOString().slice(0, 16) : "",
      ends_at: b.ends_at ? new Date(b.ends_at).toISOString().slice(0, 16) : "",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) {
      toast({ title: "Title required", description: "Please enter a banner title.", variant: "destructive" });
      return;
    }
    const ctaLink = form.cta_link.trim() || "/shop";
    if (!ctaLink.startsWith("/") && !ctaLink.startsWith("http")) {
      toast({ title: "Invalid link", description: "CTA link must start with '/' or 'https://'.", variant: "destructive" });
      return;
    }

    let startsAtIso: string | null = null;
    let endsAtIso: string | null = null;
    if (form.starts_at) {
      const s = new Date(form.starts_at);
      if (isNaN(s.getTime())) {
        toast({ title: "Invalid start date", variant: "destructive" });
        return;
      }
      startsAtIso = s.toISOString();
    }
    if (form.ends_at) {
      const e = new Date(form.ends_at);
      if (isNaN(e.getTime())) {
        toast({ title: "Invalid end date", variant: "destructive" });
        return;
      }
      endsAtIso = e.toISOString();
      if (startsAtIso && new Date(startsAtIso) > e) {
        toast({ title: "Invalid schedule", description: "End date must be after start date.", variant: "destructive" });
        return;
      }
    }

    const sortOrder = parseInt(form.sort_order, 10);
    setSaving(true);

    const payload = {
      title: form.title.trim(),
      subtitle: form.subtitle?.trim() || null,
      image_url: form.image_url?.trim() || null,
      cta_text: form.cta_text.trim() || "Shop Now",
      cta_link: ctaLink,
      bg_color: form.bg_color || "#1A4D2E",
      position: form.position,
      sort_order: isNaN(sortOrder) ? 0 : sortOrder,
      is_active: form.is_active,
      starts_at: startsAtIso,
      ends_at: endsAtIso,
    };

    if (editId) {
      const { error } = await supabase.from("banners").update(payload).eq("id", editId);
      if (error) {
        setSaving(false);
        toast({ title: "Failed to update banner", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Banner updated successfully" });
    } else {
      const { error } = await supabase.from("banners").insert(payload);
      if (error) {
        setSaving(false);
        toast({ title: "Failed to create banner", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Banner created successfully" });
    }

    setSaving(false);
    setDialogOpen(false);
    fetch();
  };

  const promptDeleteBanner = (b: any) => {
    setDeleteDialog({
      open: true,
      bannerId: b.id,
      bannerTitle: b.title,
    });
  };

  const confirmDeleteBanner = async () => {
    if (!deleteDialog.bannerId) return;
    setIsDeleting(true);

    const { error } = await supabase.from("banners").delete().eq("id", deleteDialog.bannerId);
    setIsDeleting(false);
    setDeleteDialog(prev => ({ ...prev, open: false }));

    if (error) {
      toast({ title: "Failed to delete banner", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Banner deleted successfully" });
      fetch();
    }
  };

  const positionLabels: Record<string, string> = { hero: "Hero Carousel", announcement: "Announcement Bar", popup: "Popup", promo: "Promo Banner" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-heading font-bold text-foreground">Banners & Promotions</h2>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Add Banner</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>CTA</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {banners.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No banners yet</TableCell></TableRow>
              )}
              {banners.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.title}</TableCell>
                  <TableCell><span className="text-xs bg-muted px-2 py-0.5 rounded">{positionLabels[b.position] || b.position}</span></TableCell>
                  <TableCell className="text-sm">{b.cta_text} → {b.cta_link}</TableCell>
                  <TableCell>{b.sort_order}</TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${b.is_active ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                      {b.is_active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(b)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => promptDeleteBanner(b)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit" : "New"} Banner</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Summer Wellness Sale" /></div>
            <div><Label>Subtitle</Label><Input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder="Get up to 25% off on Ashwagandha & Moringa" /></div>
            <div>
              <Label>Position</Label>
              <Select value={form.position} onValueChange={(v) => setForm({ ...form, position: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hero">Hero Carousel (Homepage)</SelectItem>
                  <SelectItem value="promo">Promo Banner (Shop & Catalog)</SelectItem>
                  <SelectItem value="announcement">Announcement Bar</SelectItem>
                  <SelectItem value="popup">Popup Modal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Image</Label><ImageUpload value={form.image_url} onChange={(url) => setForm({ ...form, image_url: url })} folder="banners" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>CTA Text</Label><Input value={form.cta_text} onChange={(e) => setForm({ ...form, cta_text: e.target.value })} placeholder="Shop Now" /></div>
              <div><Label>CTA Link</Label><Input value={form.cta_link} onChange={(e) => setForm({ ...form, cta_link: e.target.value })} placeholder="/shop" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Background Color</Label><Input type="color" value={form.bg_color} onChange={(e) => setForm({ ...form, bg_color: e.target.value })} className="h-10 p-1" /></div>
              <div><Label>Sort Order</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Start Date (optional)</Label><Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></div>
              <div><Label>End Date (optional)</Label><Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Active</Label>
            </div>
            <Button onClick={save} disabled={saving} className="w-full">
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : editId ? "Update Banner" : "Create Banner"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}
        title="Delete Banner"
        description={`Are you sure you want to delete banner "${deleteDialog.bannerTitle}"? This action cannot be undone.`}
        confirmText="Delete Banner"
        loading={isDeleting}
        onConfirm={confirmDeleteBanner}
      />
    </div>
  );
};

export default AdminBanners;
