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
import { Plus, Pencil, Trash2, Package } from "lucide-react";

const AdminBundles = () => {
  const [bundles, setBundles] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", description: "", image_url: "", bundle_price: "", is_active: true });
  const [selectedProducts, setSelectedProducts] = useState<{ product_id: string; quantity: number }[]>([]);
  const { toast } = useToast();

  const fetchAll = async () => {
    const [{ data: b }, { data: p }] = await Promise.all([
      supabase.from("product_bundles").select("*").order("created_at", { ascending: false }),
      supabase.from("products").select("id, name, price, image_url").eq("is_active", true),
    ]);
    setBundles(b || []);
    setProducts(p || []);
  };

  useEffect(() => { fetchAll(); }, []);

  const openNew = () => {
    setEditId(null);
    setForm({ name: "", slug: "", description: "", image_url: "", bundle_price: "", is_active: true });
    setSelectedProducts([]);
    setDialogOpen(true);
  };

  const openEdit = async (bundle: any) => {
    setEditId(bundle.id);
    setForm({
      name: bundle.name, slug: bundle.slug, description: bundle.description || "",
      image_url: bundle.image_url || "", bundle_price: String(bundle.bundle_price), is_active: bundle.is_active,
    });
    const { data } = await supabase.from("bundle_items").select("product_id, quantity").eq("bundle_id", bundle.id);
    setSelectedProducts(data || []);
    setDialogOpen(true);
  };

  const toggleProduct = (productId: string) => {
    setSelectedProducts(prev => {
      const exists = prev.find(p => p.product_id === productId);
      if (exists) return prev.filter(p => p.product_id !== productId);
      return [...prev, { product_id: productId, quantity: 1 }];
    });
  };

  const updateQty = (productId: string, qty: number) => {
    setSelectedProducts(prev => prev.map(p => p.product_id === productId ? { ...p, quantity: Math.max(1, qty) } : p));
  };

  const originalTotal = selectedProducts.reduce((sum, sp) => {
    const prod = products.find(p => p.id === sp.product_id);
    return sum + (prod ? prod.price * sp.quantity : 0);
  }, 0);

  const save = async () => {
    const slug = form.slug || form.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const payload = {
      name: form.name, slug, description: form.description || null,
      image_url: form.image_url || null, bundle_price: parseFloat(form.bundle_price) || 0,
      original_total: originalTotal, is_active: form.is_active,
    };

    let bundleId = editId;
    if (editId) {
      await supabase.from("product_bundles").update(payload).eq("id", editId);
      await supabase.from("bundle_items").delete().eq("bundle_id", editId);
    } else {
      const { data } = await supabase.from("product_bundles").insert(payload).select("id").single();
      bundleId = data?.id;
    }

    if (bundleId && selectedProducts.length > 0) {
      await supabase.from("bundle_items").insert(
        selectedProducts.map(sp => ({ bundle_id: bundleId!, product_id: sp.product_id, quantity: sp.quantity }))
      );
    }

    toast({ title: editId ? "Bundle updated" : "Bundle created" });
    setDialogOpen(false);
    fetchAll();
  };

  const deleteBundle = async (id: string) => {
    if (!confirm("Delete this bundle?")) return;
    await supabase.from("product_bundles").delete().eq("id", id);
    toast({ title: "Bundle deleted" });
    fetchAll();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-heading font-bold text-foreground">Product Bundles</h2>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> New Bundle</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bundle</TableHead>
                <TableHead>Original</TableHead>
                <TableHead>Bundle Price</TableHead>
                <TableHead>Savings</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bundles.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No bundles yet</TableCell></TableRow>
              )}
              {bundles.map(b => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium flex items-center gap-2"><Package className="h-4 w-4 text-primary" />{b.name}</TableCell>
                  <TableCell>₹{Number(b.original_total).toFixed(0)}</TableCell>
                  <TableCell className="font-semibold text-primary">₹{Number(b.bundle_price).toFixed(0)}</TableCell>
                  <TableCell className="text-secondary">{b.original_total > 0 ? Math.round((1 - b.bundle_price / b.original_total) * 100) : 0}% off</TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${b.is_active ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                      {b.is_active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(b)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteBundle(b.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit Bundle" : "New Bundle"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Immunity Kit" /></div>
              <div><Label>Slug</Label><Input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="auto-generated" /></div>
            </div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Bundle Price (₹)</Label><Input type="number" value={form.bundle_price} onChange={e => setForm({ ...form, bundle_price: e.target.value })} /></div>
              <div><Label>Image URL</Label><Input value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} /></div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} /><Label>Active</Label></div>

            <div>
              <Label className="mb-2 block">Select Products</Label>
              <div className="border border-border rounded-lg max-h-48 overflow-y-auto divide-y divide-border">
                {products.map(p => {
                  const selected = selectedProducts.find(sp => sp.product_id === p.id);
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50">
                      <input type="checkbox" checked={!!selected} onChange={() => toggleProduct(p.id)} className="rounded" />
                      <img src={p.image_url || "/placeholder.svg"} className="w-8 h-8 rounded object-cover" alt="" />
                      <span className="flex-1 text-sm">{p.name}</span>
                      <span className="text-sm text-muted-foreground">₹{p.price}</span>
                      {selected && (
                        <Input type="number" value={selected.quantity} onChange={e => updateQty(p.id, parseInt(e.target.value) || 1)}
                          className="w-16 h-7 text-xs" min={1} />
                      )}
                    </div>
                  );
                })}
              </div>
              {selectedProducts.length > 0 && (
                <p className="text-sm text-muted-foreground mt-2">
                  Original total: <span className="font-semibold">₹{originalTotal.toFixed(0)}</span>
                  {form.bundle_price && <> → Bundle: <span className="font-semibold text-primary">₹{form.bundle_price}</span> ({Math.round((1 - parseFloat(form.bundle_price) / originalTotal) * 100)}% off)</>}
                </p>
              )}
            </div>

            <Button onClick={save} className="w-full">{editId ? "Update" : "Create"} Bundle</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBundles;
