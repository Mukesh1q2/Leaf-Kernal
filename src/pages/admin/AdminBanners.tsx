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
import { Plus, Pencil, Trash2 } from "lucide-react";
import ImageUpload from "@/components/admin/ImageUpload";

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
  const { toast } = useToast();

  const fetch = async () => {
    const { data } = await supabase.from("banners").select("*").order("sort_order");
    setBanners(data || []);
  };

  useEffect(() => { fetch(); }, []);

  const openNew = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (b: any) => {
    setEditId(b.id);
    setForm({
      title: b.title, subtitle: b.subtitle || "", image_url: b.image_url || "",
      cta_text: b.cta_text || "Shop Now", cta_link: b.cta_link || "/shop",
      bg_color: b.bg_color || "#1A4D2E", position: b.position,
      sort_order: String(b.sort_order || 0), is_active: b.is_active,
      starts_at: b.starts_at ? new Date(b.starts_at).toISOString().slice(0, 16) : "",
      ends_at: b.ends_at ? new Date(b.ends_at).toISOString().slice(0, 16) : "",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    const payload = {
      title: form.title, subtitle: form.subtitle || null, image_url: form.image_url || null,
      cta_text: form.cta_text, cta_link: form.cta_link, bg_color: form.bg_color,
      position: form.position, sort_order: parseInt(form.sort_order) || 0, is_active: form.is_active,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
    };
    if (editId) {
      await supabase.from("banners").update(payload).eq("id", editId);
      toast({ title: "Banner updated" });
    } else {
      await supabase.from("banners").insert(payload);
      toast({ title: "Banner created" });
    }
    setDialogOpen(false);
    fetch();
  };

  const deleteBanner = async (id: string) => {
    if (!confirm("Delete this banner?")) return;
    await supabase.from("banners").delete().eq("id", id);
    toast({ title: "Banner deleted" });
    fetch();
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
                  <TableCell><span className="text-xs bg-muted px-2 py-1 rounded">{positionLabels[b.position] || b.position}</span></TableCell>
                  <TableCell className="text-sm">{b.cta_text} → {b.cta_link}</TableCell>
                  <TableCell>{b.sort_order}</TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${b.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {b.is_active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(b)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteBanner(b.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
          <DialogHeader><DialogTitle>{editId ? "Edit Banner" : "New Banner"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Subtitle</Label><Input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} /></div>
            <div><Label>Image</Label><ImageUpload value={form.image_url} onChange={(url) => setForm({ ...form, image_url: url })} folder="banners" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>CTA Text</Label><Input value={form.cta_text} onChange={(e) => setForm({ ...form, cta_text: e.target.value })} /></div>
              <div><Label>CTA Link</Label><Input value={form.cta_link} onChange={(e) => setForm({ ...form, cta_link: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Position</Label>
                <Select value={form.position} onValueChange={(v) => setForm({ ...form, position: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hero">Hero Carousel</SelectItem>
                    <SelectItem value="announcement">Announcement</SelectItem>
                    <SelectItem value="popup">Popup</SelectItem>
                    <SelectItem value="promo">Promo Banner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Background</Label><Input type="color" value={form.bg_color} onChange={(e) => setForm({ ...form, bg_color: e.target.value })} className="h-10" /></div>
              <div><Label>Sort Order</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /> Active</label>
            <Button onClick={save} className="w-full">{editId ? "Update" : "Create"} Banner</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBanners;
