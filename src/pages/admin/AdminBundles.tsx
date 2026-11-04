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
import { Plus, Pencil, Trash2, Package, Loader2 } from "lucide-react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

const AdminBundles = () => {
  const [bundles, setBundles] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", description: "", image_url: "", bundle_price: "", is_active: true });
  const [selectedProducts, setSelectedProducts] = useState<{ product_id: string; quantity: number }[]>([]);
  const [saving, setSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; bundleId: string | null; bundleName: string }>({
    open: false,
    bundleId: null,
    bundleName: "",
  });
  const { toast } = useToast();

  const fetchAll = async () => {
    const [{ data: b, error: bErr }, { data: p, error: pErr }] = await Promise.all([
      supabase.from("product_bundles").select("*").order("created_at", { ascending: false }),
      supabase.from("products").select("id, name, price, image_url").eq("is_active", true),
    ]);
    if (bErr) toast({ title: "Failed to load bundles", description: bErr.message, variant: "destructive" });
    if (pErr) toast({ title: "Failed to load products", description: pErr.message, variant: "destructive" });
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
      name: bundle.name,
      slug: bundle.slug,
      description: bundle.description || "",
      image_url: bundle.image_url || "",
      bundle_price: String(bundle.bundle_price),
      is_active: bundle.is_active ?? true,
    });
    const { data, error } = await supabase.from("bundle_items").select("product_id, quantity").eq("bundle_id", bundle.id);
    if (error) {
      toast({ title: "Failed to load bundle items", description: error.message, variant: "destructive" });
    }
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
    if (!form.name.trim()) {
      toast({ title: "Name required", description: "Please enter a bundle name.", variant: "destructive" });
      return;
    }
    const priceNum = parseFloat(form.bundle_price);
    if (isNaN(priceNum) || priceNum < 0) {
      toast({ title: "Invalid price", description: "Bundle price must be a valid non-negative number.", variant: "destructive" });
      return;
    }
    if (selectedProducts.length === 0) {
      toast({ title: "Products required", description: "Please select at least one product for this bundle.", variant: "destructive" });
      return;
    }

    const slug = (form.slug.trim() || form.name.trim()).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!slug) {
      toast({ title: "Invalid slug", description: "Slug must contain valid characters.", variant: "destructive" });
      return;
    }

    setSaving(true);

    // 1. Try atomic database RPC
    try {
      const { data: rpcData, error: rpcError } = await (supabase.rpc as any)("save_bundle_atomic", {
        p_bundle_id: editId || null,
        p_name: form.name.trim(),
        p_slug: slug,
        p_description: form.description?.trim() || null,
        p_image_url: form.image_url?.trim() || null,
        p_bundle_price: priceNum,
        p_original_total: originalTotal,
        p_is_active: form.is_active,
        p_items: selectedProducts.map(sp => ({ product_id: sp.product_id, quantity: sp.quantity })),
      });

      if (!rpcError) {
        toast({ title: editId ? "Bundle updated successfully" : "Bundle created successfully" });
        setSaving(false);
        setDialogOpen(false);
        fetchAll();
        return;
      }
    } catch {
      // Fall through to safe client-side transactional path if RPC not available
    }

    // 2. Safe transactional fallback
    const payload = {
      name: form.name.trim(),
      slug,
      description: form.description?.trim() || null,
      image_url: form.image_url?.trim() || null,
      bundle_price: priceNum,
      original_total: originalTotal,
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    };

    let bundleId = editId;
    if (editId) {
      const { error: updateErr } = await supabase.from("product_bundles").update(payload).eq("id", editId);
      if (updateErr) {
        setSaving(false);
        toast({ title: "Failed to update bundle", description: updateErr.message, variant: "destructive" });
        return;
      }
      // Only delete old items after parent update succeeds
      const { error: delErr } = await supabase.from("bundle_items").delete().eq("bundle_id", editId);
      if (delErr) {
        console.warn("Error clearing previous bundle items:", delErr);
      }
    } else {
      const { data, error: insertErr } = await supabase.from("product_bundles").insert(payload).select("id").single();
      if (insertErr || !data) {
        setSaving(false);
        toast({ title: "Failed to create bundle", description: insertErr?.message || "Insert failed", variant: "destructive" });
        return;
      }
      bundleId = data.id;
    }

    if (bundleId && selectedProducts.length > 0) {
      const { error: itemsErr } = await supabase.from("bundle_items").insert(
        selectedProducts.map(sp => ({ bundle_id: bundleId!, product_id: sp.product_id, quantity: sp.quantity }))
      );
      if (itemsErr) {
        setSaving(false);
        toast({ title: "Warning: bundle saved but items failed", description: itemsErr.message, variant: "destructive" });
        fetchAll();
        return;
      }
    }

    setSaving(false);
    toast({ title: editId ? "Bundle updated successfully" : "Bundle created successfully" });
    setDialogOpen(false);
    fetchAll();
  };

  const promptDeleteBundle = (b: any) => {
    setDeleteDialog({
      open: true,
      bundleId: b.id,
      bundleName: b.name,
    });
  };

  const confirmDeleteBundle = async () => {
    if (!deleteDialog.bundleId) return;
    setIsDeleting(true);

    // Clean up bundle_items first to preserve integrity regardless of cascade constraint
    await supabase.from("bundle_items").delete().eq("bundle_id", deleteDialog.bundleId);

    const { error } = await supabase.from("product_bundles").delete().eq("id", deleteDialog.bundleId);
    setIsDeleting(false);
    setDeleteDialog(prev => ({ ...prev, open: false }));

    if (error) {
      toast({ title: "Failed to delete bundle", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Bundle deleted successfully" });
      fetchAll();
    }
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
                    <Button variant="ghost" size="icon" onClick={() => promptDeleteBundle(b)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit" : "New"} Bundle</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Immunity Booster Combo" /></div>
            <div><Label>Slug</Label><Input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="immunity-booster-combo" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div><Label>Image URL</Label><Input value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." /></div>

            {/* Product Picker */}
            <div>
              <Label className="mb-2 block">Included Products ({selectedProducts.length} selected)</Label>
              <div className="max-h-48 overflow-y-auto space-y-1.5 border border-border rounded-lg p-2">
                {products.map(p => {
                  const sel = selectedProducts.find(sp => sp.product_id === p.id);
                  return (
                    <div key={p.id} className={`flex items-center justify-between p-2 rounded-md text-xs cursor-pointer ${sel ? "bg-primary/10 border border-primary/30" : "hover:bg-muted"}`}>
                      <div className="flex items-center gap-2 flex-1 min-w-0" onClick={() => toggleProduct(p.id)}>
                        <input type="checkbox" checked={!!sel} onChange={() => {}} className="rounded" />
                        <span className="font-medium truncate">{p.name}</span>
                        <span className="text-muted-foreground">₹{p.price}</span>
                      </div>
                      {sel && (
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <Label className="text-[10px] text-muted-foreground">Qty:</Label>
                          <Input
                            type="number"
                            min="1"
                            value={sel.quantity}
                            onChange={e => updateQty(p.id, parseInt(e.target.value) || 1)}
                            className="w-14 h-7 text-xs text-center"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Price Preview */}
            <div className="bg-muted p-3 rounded-lg text-xs space-y-1">
              <div className="flex justify-between">
                <span>Calculated Original Value:</span>
                <span className="font-medium">₹{originalTotal.toFixed(0)}</span>
              </div>
              <div className="flex justify-between">
                <span>You Save:</span>
                <span className="text-secondary font-semibold">
                  {originalTotal > 0 && form.bundle_price ? `₹${(originalTotal - parseFloat(form.bundle_price || "0")).toFixed(0)} (${Math.round((1 - parseFloat(form.bundle_price || "0") / originalTotal) * 100)}%)` : "—"}
                </span>
              </div>
            </div>

            <div><Label>Bundle Selling Price (₹)</Label><Input type="number" value={form.bundle_price} onChange={e => setForm({ ...form, bundle_price: e.target.value })} placeholder="499" /></div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
              <Label>Active &amp; Visible in Store</Label>
            </div>
            <Button onClick={save} disabled={saving} className="w-full">
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : editId ? "Update Bundle" : "Create Bundle"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}
        title={`Delete Bundle "${deleteDialog.bundleName}"`}
        description={`Are you sure you want to delete "${deleteDialog.bundleName}"? This action cannot be undone.`}
        confirmText="Delete Bundle"
        loading={isDeleting}
        onConfirm={confirmDeleteBundle}
      />
    </div>
  );
};

export default AdminBundles;
