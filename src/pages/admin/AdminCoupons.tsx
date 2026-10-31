import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Copy, Eye, EyeOff, Calendar, Target, Sparkles } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface CouponFormData {
  code: string;
  discount_type: "percentage" | "fixed" | "free_shipping";
  discount_value: string;
  max_discount: string;
  min_order_value: string;
  max_uses: string;
  per_customer_limit: string;
  valid_from: string;
  valid_to: string;
  is_active: boolean;
  first_order_only: boolean;
  show_on_storefront: boolean;
  display_title: string;
  display_message: string;
  display_from: string;
  display_to: string;
  applicable_to: "all" | "products" | "categories";
  applicable_ids: string[];
}

const emptyForm: CouponFormData = {
  code: "",
  discount_type: "percentage",
  discount_value: "",
  max_discount: "",
  min_order_value: "",
  max_uses: "",
  per_customer_limit: "1",
  valid_from: "",
  valid_to: "",
  is_active: true,
  first_order_only: false,
  show_on_storefront: false,
  display_title: "",
  display_message: "",
  display_from: "",
  display_to: "",
  applicable_to: "all",
  applicable_ids: [],
};

const AdminCoupons = () => {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CouponFormData>(emptyForm);
  const { toast } = useToast();

  const fetchCoupons = async () => {
    const { data } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
    setCoupons(data || []);
  };

  const fetchCatalog = async () => {
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase.from("products").select("id, name, price").eq("is_active", true).order("name"),
      supabase.from("categories").select("id, name").order("name"),
    ]);
    setProducts(prods || []);
    setCategories(cats || []);
  };

  useEffect(() => {
    fetchCoupons();
    fetchCatalog();
  }, []);

  const openNew = () => {
    setEditId(null);
    setForm({
      ...emptyForm,
      code: "LK" + Math.random().toString(36).substring(2, 8).toUpperCase(),
    });
    setDialogOpen(true);
  };

  const openEdit = (c: any) => {
    setEditId(c.id);
    setForm({
      code: c.code || "",
      discount_type: c.discount_type || "percentage",
      discount_value: c.discount_value != null ? String(c.discount_value) : "",
      max_discount: c.max_discount != null ? String(c.max_discount) : "",
      min_order_value: c.min_order_value != null ? String(c.min_order_value) : "",
      max_uses: c.max_uses != null ? String(c.max_uses) : "",
      per_customer_limit: String(c.per_customer_limit || 1),
      valid_from: c.valid_from ? c.valid_from.slice(0, 16) : "",
      valid_to: c.valid_to ? c.valid_to.slice(0, 16) : "",
      is_active: c.is_active ?? true,
      first_order_only: c.first_order_only ?? false,
      show_on_storefront: c.show_on_storefront ?? false,
      display_title: c.display_title || "",
      display_message: c.display_message || "",
      display_from: c.display_from ? c.display_from.slice(0, 16) : "",
      display_to: c.display_to ? c.display_to.slice(0, 16) : "",
      applicable_to: (c.applicable_to as any) || "all",
      applicable_ids: Array.isArray(c.applicable_ids) ? c.applicable_ids : [],
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.code.trim()) {
      toast({ title: "Validation Error", description: "Coupon code is required.", variant: "destructive" });
      return;
    }

    // Schedule validations
    if (form.valid_from && form.valid_to) {
      if (new Date(form.valid_to) <= new Date(form.valid_from)) {
        toast({
          title: "Schedule Error",
          description: "Coupon validity end date must be after validity start date.",
          variant: "destructive",
        });
        return;
      }
    }

    if (form.show_on_storefront) {
      if (form.display_from && form.display_to) {
        if (new Date(form.display_to) <= new Date(form.display_from)) {
          toast({
            title: "Schedule Error",
            description: "Storefront display end time must be after display start time.",
            variant: "destructive",
          });
          return;
        }
      }
    }

    if (form.applicable_to !== "all" && form.applicable_ids.length === 0) {
      toast({
        title: "Targeting Required",
        description: `Please select at least one ${form.applicable_to === "products" ? "product" : "category"}.`,
        variant: "destructive",
      });
      return;
    }

    const payload = {
      code: form.code.trim().toUpperCase(),
      discount_type: form.discount_type,
      discount_value: parseFloat(form.discount_value) || 0,
      max_discount: form.max_discount ? parseFloat(form.max_discount) : null,
      min_order_value: form.min_order_value ? parseFloat(form.min_order_value) : 0,
      max_uses: form.max_uses ? parseInt(form.max_uses, 10) : null,
      per_customer_limit: parseInt(form.per_customer_limit, 10) || 1,
      valid_from: form.valid_from ? new Date(form.valid_from).toISOString() : new Date().toISOString(),
      valid_to: form.valid_to ? new Date(form.valid_to).toISOString() : null,
      is_active: form.is_active,
      first_order_only: form.first_order_only,
      show_on_storefront: form.show_on_storefront,
      display_title: form.display_title.trim() || null,
      display_message: form.display_message.trim() || null,
      display_from: form.display_from ? new Date(form.display_from).toISOString() : null,
      display_to: form.display_to ? new Date(form.display_to).toISOString() : null,
      applicable_to: form.applicable_to,
      applicable_ids: form.applicable_to === "all" ? [] : form.applicable_ids,
    };

    if (editId) {
      const { error } = await supabase.from("coupons").update(payload).eq("id", editId);
      if (error) {
        toast({ title: "Error updating coupon", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Coupon updated" });
    } else {
      const { error } = await supabase.from("coupons").insert(payload);
      if (error) {
        toast({ title: "Error creating coupon", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Coupon created" });
    }
    setDialogOpen(false);
    fetchCoupons();
  };

  const deleteCoupon = async (id: string) => {
    if (!confirm("Delete this coupon?")) return;
    const { error } = await supabase.from("coupons").delete().eq("id", id);
    if (error) {
      toast({ title: "Error deleting coupon", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Coupon deleted" });
    fetchCoupons();
  };

  const getStorefrontStatusBadge = (c: any) => {
    if (!c.show_on_storefront) {
      return (
        <Badge variant="outline" className="text-muted-foreground flex items-center gap-1">
          <EyeOff className="h-3 w-3" /> Private Code
        </Badge>
      );
    }

    const now = new Date();
    if (c.display_from && new Date(c.display_from) > now) {
      return (
        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 flex items-center gap-1 border-blue-200">
          <Calendar className="h-3 w-3" /> Scheduled
        </Badge>
      );
    }

    if (c.display_to && new Date(c.display_to) <= now) {
      return (
        <Badge variant="secondary" className="text-muted-foreground flex items-center gap-1">
          <EyeOff className="h-3 w-3" /> Display Ended
        </Badge>
      );
    }

    return (
      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 flex items-center gap-1 border-emerald-200">
        <Sparkles className="h-3 w-3 text-emerald-600" /> Live on Storefront
      </Badge>
    );
  };

  const toggleApplicableId = (id: string) => {
    setForm((prev) => {
      const exists = prev.applicable_ids.includes(id);
      return {
        ...prev,
        applicable_ids: exists
          ? prev.applicable_ids.filter((item) => item !== id)
          : [...prev.applicable_ids, id],
      };
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-heading font-bold text-foreground">Coupons & Promotions</h2>
          <p className="text-sm text-muted-foreground">
            Manage discount codes, scheduled storefront promotions, and targeted offers.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" /> Create Coupon
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code & Promo Title</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Targeting</TableHead>
                <TableHead>Storefront Visibility</TableHead>
                <TableHead>Min Order</TableHead>
                <TableHead>Uses</TableHead>
                <TableHead>Validity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No coupons created yet
                  </TableCell>
                </TableRow>
              )}
              {coupons.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm bg-muted px-1.5 py-0.5 rounded">
                          {c.code}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(c.code);
                            toast({ title: "Copied code!" });
                          }}
                          className="text-muted-foreground hover:text-foreground"
                          title="Copy Code"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                      {c.display_title && (
                        <p className="text-xs font-medium text-foreground line-clamp-1">{c.display_title}</p>
                      )}
                      {c.display_message && (
                        <p className="text-[11px] text-muted-foreground line-clamp-1">{c.display_message}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-semibold">
                      {c.discount_type === "percentage"
                        ? `${c.discount_value}%`
                        : c.discount_type === "fixed"
                        ? `₹${c.discount_value}`
                        : "Free Shipping"}
                    </div>
                    {c.max_discount && c.discount_type === "percentage" && (
                      <span className="text-[10px] text-muted-foreground block">
                        Capped at ₹{c.max_discount}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-xs">
                      <Target className="h-3 w-3 text-muted-foreground" />
                      {c.applicable_to === "products" ? (
                        <span>{c.applicable_ids?.length || 0} Products</span>
                      ) : c.applicable_to === "categories" ? (
                        <span>{c.applicable_ids?.length || 0} Categories</span>
                      ) : (
                        <span>All Products</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getStorefrontStatusBadge(c)}</TableCell>
                  <TableCell className="text-sm">₹{c.min_order_value || 0}</TableCell>
                  <TableCell className="text-sm">
                    {c.used_count || 0}/{c.max_uses || "∞"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.valid_to ? new Date(c.valid_to).toLocaleDateString() : "No expiry"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        c.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                      }`}
                    >
                      {c.is_active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteCoupon(c.id)}
                        className="text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Coupon & Promotion" : "Create Coupon & Promotion"}</DialogTitle>
            <DialogDescription>
              Configure discount mechanics, customer-facing storefront presentation, display schedule, and targeting rules.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 pt-2">
            {/* Core Code & Type */}
            <div className="space-y-4 rounded-lg border p-4 bg-muted/20">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                Discount Mechanics
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Coupon Code *</Label>
                  <Input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. MONSOON20"
                    className="font-mono uppercase font-bold"
                  />
                </div>
                <div>
                  <Label>Discount Type</Label>
                  <Select
                    value={form.discount_type}
                    onValueChange={(v: any) => setForm({ ...form, discount_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                      <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                      <SelectItem value="free_shipping">Free Shipping</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Discount Value *</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.discount_value}
                    onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                    placeholder={form.discount_type === "percentage" ? "e.g. 15" : "e.g. 200"}
                  />
                </div>
                <div>
                  <Label>Max Discount (₹ Cap)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.max_discount}
                    onChange={(e) => setForm({ ...form, max_discount: e.target.value })}
                    placeholder="Unlimited"
                    disabled={form.discount_type !== "percentage"}
                  />
                  <span className="text-[10px] text-muted-foreground">For % discounts only</span>
                </div>
                <div>
                  <Label>Min Order (₹)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.min_order_value}
                    onChange={(e) => setForm({ ...form, min_order_value: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Scope / Targeting */}
            <div className="space-y-3 rounded-lg border p-4 bg-muted/20">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" /> Product & Category Targeting
              </h3>
              <p className="text-xs text-muted-foreground">
                Apply discount to all eligible products, selected items, or entire categories.
              </p>
              <div>
                <Label>Applicable Scope</Label>
                <Select
                  value={form.applicable_to}
                  onValueChange={(v: any) =>
                    setForm({ ...form, applicable_to: v, applicable_ids: [] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Eligible Products</SelectItem>
                    <SelectItem value="categories">Selected Categories Only</SelectItem>
                    <SelectItem value="products">Selected Products Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.applicable_to === "categories" && (
                <div className="space-y-2 pt-2 border-t mt-2">
                  <Label className="text-xs font-semibold">Select Eligible Categories ({form.applicable_ids.length} selected)</Label>
                  <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 bg-background rounded border">
                    {categories.map((cat) => (
                      <label key={cat.id} className="flex items-center gap-2 text-xs cursor-pointer">
                        <Checkbox
                          checked={form.applicable_ids.includes(cat.id)}
                          onCheckedChange={() => toggleApplicableId(cat.id)}
                        />
                        <span>{cat.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {form.applicable_to === "products" && (
                <div className="space-y-2 pt-2 border-t mt-2">
                  <Label className="text-xs font-semibold">Select Eligible Products ({form.applicable_ids.length} selected)</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto p-2 bg-background rounded border">
                    {products.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-xs cursor-pointer">
                        <Checkbox
                          checked={form.applicable_ids.includes(p.id)}
                          onCheckedChange={() => toggleApplicableId(p.id)}
                        />
                        <span className="truncate">{p.name} (₹{p.price})</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Storefront Promotion & Scheduling */}
            <div className="space-y-4 rounded-lg border p-4 bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Eye className="h-4 w-4 text-emerald-600" /> Show on Storefront
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Highlight offer in promo banners, eligible product cards, product details, and the cart.
                  </p>
                </div>
                <Switch
                  checked={form.show_on_storefront}
                  onCheckedChange={(v) => setForm({ ...form, show_on_storefront: v })}
                />
              </div>

              {form.show_on_storefront && (
                <div className="space-y-4 pt-3 border-t">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Customer-Facing Title</Label>
                      <Input
                        value={form.display_title}
                        onChange={(e) => setForm({ ...form, display_title: e.target.value })}
                        placeholder="e.g. Monsoon Wellness Offer"
                      />
                      <span className="text-[10px] text-muted-foreground">Short promo headline</span>
                    </div>
                    <div>
                      <Label>Customer-Facing Message</Label>
                      <Input
                        value={form.display_message}
                        onChange={(e) => setForm({ ...form, display_message: e.target.value })}
                        placeholder="e.g. Save 15% on all Ayurvedic wellness superfoods"
                      />
                      <span className="text-[10px] text-muted-foreground">Offer details or terms summary</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Display Schedule Start</Label>
                      <Input
                        type="datetime-local"
                        value={form.display_from}
                        onChange={(e) => setForm({ ...form, display_from: e.target.value })}
                      />
                      <span className="text-[10px] text-muted-foreground">When offer appears on storefront</span>
                    </div>
                    <div>
                      <Label>Display Schedule End</Label>
                      <Input
                        type="datetime-local"
                        value={form.display_to}
                        onChange={(e) => setForm({ ...form, display_to: e.target.value })}
                      />
                      <span className="text-[10px] text-muted-foreground">Must be after display start time</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Redemption Limits & Coupon Validity */}
            <div className="space-y-4 rounded-lg border p-4 bg-muted/20">
              <h3 className="text-sm font-semibold text-foreground">Redemption Rules & Validity</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Validity Start Date</Label>
                  <Input
                    type="datetime-local"
                    value={form.valid_from}
                    onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Validity Expiration Date</Label>
                  <Input
                    type="datetime-local"
                    value={form.valid_to}
                    onChange={(e) => setForm({ ...form, valid_to: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Total Max Uses</Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.max_uses}
                    onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                    placeholder="Unlimited"
                  />
                  <span className="text-[10px] text-muted-foreground">Global coupon redemption cap</span>
                </div>
                <div>
                  <Label>Per-Customer Limit</Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.per_customer_limit}
                    onChange={(e) => setForm({ ...form, per_customer_limit: e.target.value })}
                    placeholder="1"
                  />
                  <span className="text-[10px] text-muted-foreground">Max uses per registered user</span>
                </div>
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Switch
                    checked={form.is_active}
                    onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                  />
                  <span className="font-medium">Active</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Switch
                    checked={form.first_order_only}
                    onCheckedChange={(v) => setForm({ ...form, first_order_only: v })}
                  />
                  <span className="font-medium">First Order Only</span>
                </label>
              </div>
            </div>

            <Button onClick={save} className="w-full text-base py-5">
              {editId ? "Update Coupon & Promotion" : "Create Coupon & Promotion"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCoupons;
