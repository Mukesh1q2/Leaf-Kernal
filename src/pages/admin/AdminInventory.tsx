import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Package, AlertTriangle, XCircle, History, SlidersHorizontal, Loader2 } from "lucide-react";
import { validateInventoryAdjustment } from "@/lib/cmsValidation";

interface ProductStock {
  id: string;
  name: string;
  slug: string;
  stock_quantity: number | null;
  price: number;
  image_url: string | null;
  is_active: boolean | null;
}

interface StockMovement {
  id: string;
  product_id: string;
  quantity_delta: number;
  old_quantity: number;
  new_quantity: number;
  reason: "restock" | "damage" | "audit_correction" | "sale_return" | "manual_adjustment" | "order_placed" | "order_cancelled";
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

type AdjustmentReason = "restock" | "damage" | "audit_correction" | "sale_return" | "manual_adjustment";

const REASON_LABELS: Record<string, string> = {
  restock: "Restock / Supplier Delivery",
  damage: "Damaged / Expired Stock",
  audit_correction: "Physical Audit Correction",
  sale_return: "Customer Return",
  manual_adjustment: "Manual Adjustment",
  order_placed: "Customer Order Placed",
  order_cancelled: "Order Cancelled / Restocked",
};

const AdminInventory = () => {
  const [products, setProducts] = useState<ProductStock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "in_stock" | "low_stock" | "out_of_stock">("all");

  // Adjustment Dialog State
  const [adjustingProduct, setAdjustingProduct] = useState<ProductStock | null>(null);
  const [newQuantityInput, setNewQuantityInput] = useState<string>("");
  const [selectedReason, setSelectedReason] = useState<AdjustmentReason>("restock");
  const [adjustmentNotes, setAdjustmentNotes] = useState<string>("");
  const [isSubmittingAdjustment, setIsSubmittingAdjustment] = useState(false);

  // History Dialog State
  const [historyProduct, setHistoryProduct] = useState<ProductStock | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const { toast } = useToast();

  const fetchData = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("id, name, slug, stock_quantity, price, image_url, is_active")
      .order("stock_quantity", { ascending: true });

    if (error) {
      toast({ title: "Failed to load inventory", description: error.message, variant: "destructive" });
    } else {
      setProducts(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAdjustDialog = (product: ProductStock) => {
    setAdjustingProduct(product);
    setNewQuantityInput(String(product.stock_quantity ?? 0));
    setSelectedReason("restock");
    setAdjustmentNotes("");
  };

  const openHistoryDialog = async (product: ProductStock) => {
    setHistoryProduct(product);
    setIsLoadingHistory(true);
    const { data, error } = await supabase
      .from("stock_movements")
      .select("*")
      .eq("product_id", product.id)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      toast({ title: "Could not load stock history", description: error.message, variant: "destructive" });
      setMovements([]);
    } else {
      setMovements((data as StockMovement[]) || []);
    }
    setIsLoadingHistory(false);
  };

  const handleSaveAdjustment = async () => {
    if (!adjustingProduct) return;

    const currentQty = adjustingProduct.stock_quantity ?? 0;
    const validation = validateInventoryAdjustment(currentQty, newQuantityInput, selectedReason);
    if (!validation.valid) {
      if (validation.error === "The new quantity is identical to current stock.") {
        toast({ title: "No change", description: validation.error });
        setAdjustingProduct(null);
        return;
      }
      toast({ title: "Invalid adjustment", description: validation.error, variant: "destructive" });
      return;
    }

    const targetQty = validation.target!;
    const delta = validation.delta!;

    setIsSubmittingAdjustment(true);

    try {
      // Execute the atomic adjust_product_stock RPC which updates products and logs to stock_movements ledger
      let rpcSuccess = false;
      const { error: rpcError } = await supabase.rpc("adjust_product_stock" as any, {
        p_product_id: adjustingProduct.id,
        p_new_quantity: targetQty,
        p_delta: delta,
        p_reason: selectedReason,
        p_notes: adjustmentNotes.trim() ? adjustmentNotes.trim() : undefined,
      });

      if (!rpcError) {
        rpcSuccess = true;
      } else {
        const errMsg = rpcError.message.toLowerCase();
        // If RPC function is not found on remote server, fall back to direct update (which invokes trigger)
        if (errMsg.includes("could not find the function") || errMsg.includes("does not exist")) {
          const { error: fallbackError } = await supabase
            .from("products")
            .update({ stock_quantity: targetQty })
            .eq("id", adjustingProduct.id);

          if (fallbackError) throw fallbackError;
          rpcSuccess = true;
        } else {
          throw rpcError;
        }
      }

      if (rpcSuccess) {
        toast({
          title: "Stock adjusted successfully",
          description: `${adjustingProduct.name} stock updated from ${currentQty} to ${targetQty} (${delta > 0 ? `+${delta}` : delta}).`,
        });
        setAdjustingProduct(null);
        await fetchData();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred while adjusting stock.";
      toast({
        title: "Failed to adjust stock",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmittingAdjustment(false);
    }
  };

  const outOfStock = products.filter((p) => (p.stock_quantity ?? 0) === 0);
  const lowStock = products.filter((p) => (p.stock_quantity ?? 0) > 0 && (p.stock_quantity ?? 0) < 10);
  const totalValue = products.reduce((s, p) => s + (p.stock_quantity ?? 0) * p.price, 0);

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      !searchQuery.trim() ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.slug.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    const qty = p.stock_quantity ?? 0;
    if (statusFilter === "in_stock") return qty >= 10;
    if (statusFilter === "low_stock") return qty > 0 && qty < 10;
    if (statusFilter === "out_of_stock") return qty === 0;
    return true;
  });

  const getStatus = (qty: number | null) => {
    const q = qty ?? 0;
    if (q === 0) return { label: "Out of Stock", cls: "bg-red-100 text-red-800" };
    if (q < 10) return { label: "Low Stock", cls: "bg-yellow-100 text-yellow-800" };
    return { label: "In Stock", cls: "bg-green-100 text-green-800" };
  };

  const currentStock = adjustingProduct?.stock_quantity ?? 0;
  const parsedTarget = parseInt(newQuantityInput, 10);
  const calculatedDelta = isNaN(parsedTarget) ? 0 : parsedTarget - currentStock;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-heading font-bold text-foreground">Inventory & Stock Ledger</h2>
          <p className="text-sm text-muted-foreground">Manage product stock levels with transactional ledger audit history.</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Total SKUs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" /> {products.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Total Stock Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">₹{totalValue.toLocaleString("en-IN")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Low Stock (&lt; 10)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" /> {lowStock.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Out of Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" /> {outOfStock.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products by name or slug..."
            className="w-full"
          />
        </div>
        <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All Stock Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses ({products.length})</SelectItem>
            <SelectItem value="in_stock">In Stock ({products.length - lowStock.length - outOfStock.length})</SelectItem>
            <SelectItem value="low_stock">Low Stock ({lowStock.length})</SelectItem>
            <SelectItem value="out_of_stock">Out of Stock ({outOfStock.length})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Inventory Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Current Stock</TableHead>
                <TableHead>Stock Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Loading inventory...
                  </TableCell>
                </TableRow>
              ) : filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {searchQuery || statusFilter !== "all"
                      ? "No products matching your search criteria."
                      : "No products found."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((p) => {
                  const status = getStatus(p.stock_quantity);
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-muted overflow-hidden shrink-0">
                            <img src={p.image_url || "/placeholder.svg"} alt={p.name} className="w-full h-full object-cover" />
                          </div>
                          <div>
                            <span className="font-medium text-sm block">{p.name}</span>
                            <span className="text-xs text-muted-foreground font-mono">{p.slug}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">₹{p.price}</TableCell>
                      <TableCell>
                        <span className="font-mono text-base font-semibold">{p.stock_quantity ?? 0}</span>
                      </TableCell>
                      <TableCell className="text-sm">₹{((p.stock_quantity || 0) * p.price).toLocaleString("en-IN")}</TableCell>
                      <TableCell>
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${status.cls}`}>{status.label}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1 text-muted-foreground hover:text-foreground"
                            onClick={() => openHistoryDialog(p)}
                            title="View Stock Movement History"
                          >
                            <History className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline text-xs">History</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1"
                            onClick={() => openAdjustDialog(p)}
                          >
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                            <span>Adjust</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Stock Adjustment Dialog */}
      <Dialog open={!!adjustingProduct} onOpenChange={(open) => !open && setAdjustingProduct(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust Stock: {adjustingProduct?.name}</DialogTitle>
            <DialogDescription>
              All adjustments are recorded in the stock ledger with user attribution and reason.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="bg-muted/50 p-3 rounded-lg flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Current Available Stock:</span>
              <span className="font-mono font-bold text-base">{currentStock}</span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="target-quantity">New Total Stock Quantity</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="target-quantity"
                  type="number"
                  min="0"
                  value={newQuantityInput}
                  onChange={(e) => setNewQuantityInput(e.target.value)}
                  placeholder="Enter new quantity"
                  className="font-mono"
                  autoFocus
                />
                <div className="shrink-0 text-sm font-mono">
                  {calculatedDelta > 0 ? (
                    <span className="text-green-600 font-semibold">+{calculatedDelta} (Add)</span>
                  ) : calculatedDelta < 0 ? (
                    <span className="text-red-600 font-semibold">{calculatedDelta} (Deduct)</span>
                  ) : (
                    <span className="text-muted-foreground">0 (No change)</span>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adjustment-reason">Adjustment Reason *</Label>
              <Select value={selectedReason} onValueChange={(val) => setSelectedReason(val as AdjustmentReason)}>
                <SelectTrigger id="adjustment-reason">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="restock">Restock / Supplier Delivery</SelectItem>
                  <SelectItem value="damage">Damaged / Expired Goods</SelectItem>
                  <SelectItem value="audit_correction">Physical Count Audit Correction</SelectItem>
                  <SelectItem value="sale_return">Customer Return</SelectItem>
                  <SelectItem value="manual_adjustment">Manual Adjustment</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adjustment-notes">Notes / Reference (Optional)</Label>
              <Textarea
                id="adjustment-notes"
                value={adjustmentNotes}
                onChange={(e) => setAdjustmentNotes(e.target.value)}
                placeholder="e.g. PO #1042 or shelf count recount"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustingProduct(null)} disabled={isSubmittingAdjustment}>
              Cancel
            </Button>
            <Button onClick={handleSaveAdjustment} disabled={isSubmittingAdjustment}>
              {isSubmittingAdjustment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save & Record Movement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock History Dialog */}
      <Dialog open={!!historyProduct} onOpenChange={(open) => !open && setHistoryProduct(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Stock Movement History: {historyProduct?.name}
            </DialogTitle>
            <DialogDescription>
              Chronological ledger of stock updates, customer orders, and manual adjustments.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto py-2">
            {isLoadingHistory ? (
              <div className="py-12 text-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                Loading movement ledger...
              </div>
            ) : movements.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground border rounded-lg">
                No recorded stock movements found for this product yet.
              </div>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Change</TableHead>
                      <TableHead>Stock Level</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((m) => {
                      const deltaPositive = m.quantity_delta > 0;
                      return (
                        <TableRow key={m.id}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(m.created_at).toLocaleString("en-IN", {
                              timeZone: "Asia/Kolkata",
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </TableCell>
                          <TableCell className="text-xs font-medium">
                            {REASON_LABELS[m.reason] || m.reason}
                          </TableCell>
                          <TableCell className="font-mono text-sm font-semibold whitespace-nowrap">
                            <span className={deltaPositive ? "text-green-600" : "text-red-600"}>
                              {deltaPositive ? `+${m.quantity_delta}` : m.quantity_delta}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                            {m.old_quantity} &rarr; {m.new_quantity}
                          </TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate" title={m.notes || ""}>
                            {m.notes || "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryProduct(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminInventory;
