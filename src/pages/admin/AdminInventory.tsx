import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Package, AlertTriangle, XCircle, Save } from "lucide-react";

interface ProductStock {
  id: string;
  name: string;
  slug: string;
  stock_quantity: number | null;
  price: number;
  image_url: string | null;
  is_active: boolean | null;
}

const AdminInventory = () => {
  const [products, setProducts] = useState<ProductStock[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const { toast } = useToast();

  const fetchData = async () => {
    const { data } = await supabase.from("products").select("id, name, slug, stock_quantity, price, image_url, is_active").order("stock_quantity", { ascending: true });
    setProducts(data || []);
  };

  useEffect(() => { fetchData(); }, []);

  const saveStock = async (id: string) => {
    const qty = parseInt(editValue);
    if (isNaN(qty) || qty < 0) return;
    await supabase.from("products").update({ stock_quantity: qty }).eq("id", id);
    toast({ title: "Stock updated" });
    setEditingId(null);
    fetchData();
  };

  const outOfStock = products.filter(p => (p.stock_quantity || 0) === 0);
  const lowStock = products.filter(p => (p.stock_quantity || 0) > 0 && (p.stock_quantity || 0) < 10);
  const healthy = products.filter(p => (p.stock_quantity || 0) >= 10);
  const totalValue = products.reduce((s, p) => s + (p.stock_quantity || 0) * p.price, 0);

  const getStatus = (qty: number | null) => {
    const q = qty || 0;
    if (q === 0) return { label: "Out of Stock", cls: "bg-red-100 text-red-800" };
    if (q < 10) return { label: "Low Stock", cls: "bg-yellow-100 text-yellow-800" };
    return { label: "In Stock", cls: "bg-green-100 text-green-800" };
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-heading font-bold text-foreground">Inventory</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total SKUs</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold flex items-center gap-2"><Package className="h-4 w-4 text-primary" /> {products.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Stock Value</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold">₹{totalValue.toLocaleString("en-IN")}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Low Stock</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-yellow-500" /> {lowStock.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Out of Stock</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold flex items-center gap-2"><XCircle className="h-4 w-4 text-destructive" /> {outOfStock.length}</div></CardContent>
        </Card>
      </div>

      {/* Inventory Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock Qty</TableHead>
                <TableHead>Stock Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => {
                const status = getStatus(p.stock_quantity);
                const isEditing = editingId === p.id;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-muted overflow-hidden shrink-0">
                          <img src={p.image_url || "/placeholder.svg"} alt={p.name} className="w-full h-full object-cover" />
                        </div>
                        <span className="font-medium text-sm">{p.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>₹{p.price}</TableCell>
                    <TableCell>
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <Input type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)} className="w-20 h-8 text-sm"
                            onKeyDown={(e) => e.key === "Enter" && saveStock(p.id)} autoFocus />
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => saveStock(p.id)}>
                            <Save className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <button className="font-mono text-sm hover:underline" onClick={() => { setEditingId(p.id); setEditValue(String(p.stock_quantity || 0)); }}>
                          {p.stock_quantity ?? 0}
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">₹{((p.stock_quantity || 0) * p.price).toLocaleString("en-IN")}</TableCell>
                    <TableCell><span className={`text-xs font-medium px-2 py-1 rounded-full ${status.cls}`}>{status.label}</span></TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => { setEditingId(p.id); setEditValue(String(p.stock_quantity || 0)); }}>
                        Adjust
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminInventory;
