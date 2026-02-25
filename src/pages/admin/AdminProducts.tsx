import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, ImagePlus } from "lucide-react";

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  original_price: number | null;
  image_url: string | null;
  is_active: boolean | null;
  is_featured: boolean | null;
  stock_quantity: number | null;
  short_description: string | null;
  description: string | null;
}

const emptyForm = {
  name: "", slug: "", price: "", original_price: "", short_description: "", description: "", stock_quantity: "100", is_active: true, is_featured: false,
};

const AdminProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [genLoading, setGenLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchProducts = async () => {
    const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    setProducts(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchProducts(); }, []);

  const openNew = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };

  const openEdit = (p: Product) => {
    setEditId(p.id);
    setForm({
      name: p.name, slug: p.slug, price: String(p.price),
      original_price: p.original_price ? String(p.original_price) : "",
      short_description: p.short_description || "", description: p.description || "",
      stock_quantity: String(p.stock_quantity ?? 100),
      is_active: p.is_active ?? true, is_featured: p.is_featured ?? false,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    const payload = {
      name: form.name,
      slug: form.slug || form.name.toLowerCase().replace(/\s+/g, "-"),
      price: parseFloat(form.price),
      original_price: form.original_price ? parseFloat(form.original_price) : null,
      short_description: form.short_description || null,
      description: form.description || null,
      stock_quantity: parseInt(form.stock_quantity) || 100,
      is_active: form.is_active,
      is_featured: form.is_featured,
    };
    if (editId) {
      await supabase.from("products").update(payload).eq("id", editId);
      toast({ title: "Product updated" });
    } else {
      await supabase.from("products").insert(payload);
      toast({ title: "Product created" });
    }
    setDialogOpen(false);
    fetchProducts();
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    await supabase.from("products").delete().eq("id", id);
    toast({ title: "Product deleted" });
    fetchProducts();
  };

  const generateImage = async (product: Product) => {
    setGenLoading(product.id);
    try {
      const { data, error } = await supabase.functions.invoke("generate-product-image", {
        body: { productId: product.id, productName: product.name, description: product.short_description || product.description || "" },
      });
      if (error) throw error;
      toast({ title: "Image generated!", description: "Product image has been updated." });
      fetchProducts();
    } catch (e: any) {
      toast({ title: "Image generation failed", description: e.message, variant: "destructive" });
    } finally {
      setGenLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-heading font-bold text-foreground">Products</h2>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Add Product</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="w-10 h-10 rounded bg-muted overflow-hidden">
                      <img src={p.image_url || "/placeholder.svg"} alt={p.name} className="w-full h-full object-cover" />
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>₹{p.price}</TableCell>
                  <TableCell>{p.stock_quantity}</TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${p.is_active ? "bg-secondary/20 text-secondary" : "bg-muted text-muted-foreground"}`}>
                      {p.is_active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => generateImage(p)} disabled={genLoading === p.id} title="Generate AI Image">
                        <ImagePlus className={`h-4 w-4 ${genLoading === p.id ? "animate-pulse" : ""}`} />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteProduct(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
          <DialogHeader><DialogTitle>{editId ? "Edit Product" : "New Product"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto-generated if blank" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Price (₹)</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
              <div><Label>Original Price</Label><Input type="number" value={form.original_price} onChange={(e) => setForm({ ...form, original_price: e.target.value })} /></div>
            </div>
            <div><Label>Short Description</Label><Textarea value={form.short_description} onChange={(e) => setForm({ ...form, short_description: e.target.value })} rows={2} /></div>
            <div><Label>Stock</Label><Input type="number" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} /></div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} /> Featured</label>
            </div>
            <Button onClick={save} className="w-full">{editId ? "Update" : "Create"} Product</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminProducts;
