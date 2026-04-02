import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import RichTextEditor from "@/components/RichTextEditor";
import ImageUpload from "@/components/admin/ImageUpload";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, ImagePlus, Search, Download } from "lucide-react";

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
  badge: string | null;
  ingredients: string | null;
  how_to_use: string | null;
  benefits: string | null;
  category_id: string | null;
}

const emptyForm = {
  name: "", slug: "", price: "", original_price: "", short_description: "", description: "",
  stock_quantity: "100", is_active: true, is_featured: false, badge: "",
  ingredients: "", how_to_use: "", benefits: "", category_id: "",
  image_url: "", seo_title: "", seo_description: "",
};

const AdminProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [genLoading, setGenLoading] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { toast } = useToast();

  const fetchProducts = async () => {
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("categories").select("*").order("sort_order"),
    ]);
    setProducts(prods || []);
    setCategories(cats || []);
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
      badge: p.badge || "",
      ingredients: p.ingredients || "", how_to_use: p.how_to_use || "",
      benefits: p.benefits || "", category_id: p.category_id || "",
      image_url: p.image_url || "", seo_title: "", seo_description: "",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    const payload: any = {
      name: form.name,
      slug: form.slug || form.name.toLowerCase().replace(/\s+/g, "-"),
      price: parseFloat(form.price),
      original_price: form.original_price ? parseFloat(form.original_price) : null,
      short_description: form.short_description || null,
      description: form.description || null,
      stock_quantity: parseInt(form.stock_quantity) || 100,
      is_active: form.is_active,
      is_featured: form.is_featured,
      badge: form.badge || null,
      ingredients: form.ingredients || null,
      how_to_use: form.how_to_use || null,
      benefits: form.benefits || null,
      category_id: form.category_id || null,
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

  const exportCSV = () => {
    const headers = "Name,Slug,Price,Original Price,Stock,Status,Category\n";
    const rows = products.map(p => `"${p.name}","${p.slug}",${p.price},${p.original_price || ""},${p.stock_quantity},"${p.is_active ? "Active" : "Draft"}","${categories.find(c => c.id === p.category_id)?.name || ""}"`).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "products.csv"; a.click();
  };

  let filtered = products;
  if (search) filtered = filtered.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.slug.includes(search.toLowerCase()));
  if (statusFilter === "active") filtered = filtered.filter(p => p.is_active);
  if (statusFilter === "draft") filtered = filtered.filter(p => !p.is_active);
  if (statusFilter === "low") filtered = filtered.filter(p => (p.stock_quantity || 0) < 10);

  const getStockStatus = (qty: number | null) => {
    const q = qty || 0;
    if (q === 0) return { label: "Out of Stock", cls: "bg-red-100 text-red-800" };
    if (q < 10) return { label: "Low Stock", cls: "bg-yellow-100 text-yellow-800" };
    return { label: "In Stock", cls: "bg-green-100 text-green-800" };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-heading font-bold text-foreground">Products</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="mr-1 h-4 w-4" /> Export</Button>
          <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Add Product</Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Products</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="low">Low Stock</SelectItem>
          </SelectContent>
        </Select>
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
                <TableHead>Stock Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const ss = getStockStatus(p.stock_quantity);
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="w-10 h-10 rounded bg-muted overflow-hidden">
                        <img src={p.image_url || "/placeholder.svg"} alt={p.name} className="w-full h-full object-cover" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">{p.name}</span>
                        {p.badge && <span className="ml-2 text-xs bg-secondary/20 text-secondary px-1.5 py-0.5 rounded">{p.badge}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-semibold">₹{p.price}</span>
                        {p.original_price && <span className="text-xs text-muted-foreground line-through ml-1">₹{p.original_price}</span>}
                      </div>
                    </TableCell>
                    <TableCell>{p.stock_quantity}</TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${p.is_active ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}`}>
                        {p.is_active ? "Active" : "Draft"}
                      </span>
                    </TableCell>
                    <TableCell><span className={`text-xs font-medium px-2 py-1 rounded-full ${ss.cls}`}>{ss.label}</span></TableCell>
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
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Multi-tab Product Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit Product" : "New Product"}</DialogTitle></DialogHeader>
          <Tabs defaultValue="basic">
            <TabsList className="w-full grid grid-cols-5">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="pricing">Pricing</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
              <TabsTrigger value="seo">SEO</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <div><Label>Product Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto-generated if blank" /></div>
              <div>
                <Label>Category</Label>
                <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Short Description</Label>
                <Textarea value={form.short_description} onChange={(e) => setForm({ ...form, short_description: e.target.value })} rows={2} maxLength={160} />
                <p className="text-xs text-muted-foreground mt-1">{form.short_description.length}/160</p>
              </div>
              <div><Label>Full Description</Label><RichTextEditor content={form.description} onChange={(html) => setForm({ ...form, description: html })} placeholder="Detailed product description..." /></div>
              <div><Label>Badge</Label><Input value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} placeholder="e.g. Best Seller, New" /></div>
            </TabsContent>

            <TabsContent value="pricing" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Price (₹) *</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
                <div><Label>Compare-at Price</Label><Input type="number" value={form.original_price} onChange={(e) => setForm({ ...form, original_price: e.target.value })} /></div>
              </div>
              {form.price && form.original_price && parseFloat(form.original_price) > parseFloat(form.price) && (
                <p className="text-sm text-secondary font-medium">
                  Discount: {Math.round((1 - parseFloat(form.price) / parseFloat(form.original_price)) * 100)}% off
                </p>
              )}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm"><Switch checked={form.is_featured} onCheckedChange={(v) => setForm({ ...form, is_featured: v })} /> Featured Product</label>
              </div>
            </TabsContent>

            <TabsContent value="details" className="space-y-4 mt-4">
              <div><Label>Ingredients</Label><Textarea value={form.ingredients} onChange={(e) => setForm({ ...form, ingredients: e.target.value })} rows={3} /></div>
              <div><Label>How to Use</Label><Textarea value={form.how_to_use} onChange={(e) => setForm({ ...form, how_to_use: e.target.value })} rows={3} /></div>
              <div><Label>Benefits</Label><RichTextEditor content={form.benefits} onChange={(html) => setForm({ ...form, benefits: html })} placeholder="List product benefits..." /></div>
            </TabsContent>

            <TabsContent value="inventory" className="space-y-4 mt-4">
              <div><Label>Stock Quantity</Label><Input type="number" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} /></div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /> Active (visible to customers)</label>
              </div>
            </TabsContent>

            <TabsContent value="seo" className="space-y-4 mt-4">
              <div>
                <Label>SEO Title</Label>
                <Input value={form.seo_title || form.name} onChange={(e) => setForm({ ...form, seo_title: e.target.value })} maxLength={60} />
                <p className="text-xs text-muted-foreground mt-1">{(form.seo_title || form.name).length}/60</p>
              </div>
              <div>
                <Label>Meta Description</Label>
                <Textarea value={form.seo_description || form.short_description} onChange={(e) => setForm({ ...form, seo_description: e.target.value })} rows={2} maxLength={160} />
                <p className="text-xs text-muted-foreground mt-1">{(form.seo_description || form.short_description).length}/160</p>
              </div>
              {/* Google SERP Preview */}
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Google Preview</p>
                <p className="text-blue-700 text-sm font-medium truncate">{form.seo_title || form.name || "Product Title"} | Leaf & Kernel</p>
                <p className="text-xs text-green-700">leafandkernel.com/product/{form.slug || "..."}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{form.seo_description || form.short_description || "Product description..."}</p>
              </div>
            </TabsContent>
          </Tabs>

          <Button onClick={save} className="w-full mt-4">{editId ? "Update" : "Create"} Product</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminProducts;
