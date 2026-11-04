import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

const emptyForm = { name: "", slug: "", description: "", sort_order: "0", parent_id: "", image_url: "" };

const AdminCategories = () => {
  const [items, setItems] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    categoryId: string | null;
    categoryName: string;
    productCount: number;
    subcatCount: number;
  }>({
    open: false,
    categoryId: null,
    categoryName: "",
    productCount: 0,
    subcatCount: 0,
  });
  const { toast } = useToast();

  const fetch = async () => {
    const { data, error } = await supabase.from("categories").select("*").order("sort_order");
    if (error) {
      toast({ title: "Failed to load categories", description: error.message, variant: "destructive" });
    } else {
      setItems(data || []);
    }
  };

  useEffect(() => { fetch(); }, []);

  const openNew = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (c: any) => {
    setEditId(c.id);
    setForm({
      name: c.name,
      slug: c.slug,
      description: c.description || "",
      sort_order: String(c.sort_order || 0),
      parent_id: c.parent_id || "",
      image_url: c.image_url || "",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast({ title: "Name required", description: "Please enter a category name.", variant: "destructive" });
      return;
    }
    const slug = (form.slug.trim() || form.name.trim()).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!slug) {
      toast({ title: "Invalid slug", description: "Slug must contain valid alphanumeric characters.", variant: "destructive" });
      return;
    }
    const sortOrder = parseInt(form.sort_order, 10);

    setSaving(true);
    const payload: any = {
      name: form.name.trim(),
      slug,
      description: form.description?.trim() || null,
      sort_order: isNaN(sortOrder) ? 0 : sortOrder,
      parent_id: form.parent_id || null,
      image_url: form.image_url?.trim() || null,
    };

    if (editId) {
      const { error } = await supabase.from("categories").update(payload).eq("id", editId);
      if (error) {
        setSaving(false);
        toast({ title: "Failed to update category", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Category updated successfully" });
    } else {
      const { error } = await supabase.from("categories").insert(payload);
      if (error) {
        setSaving(false);
        toast({ title: "Failed to create category", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Category created successfully" });
    }

    setSaving(false);
    setDialogOpen(false);
    fetch();
  };

  const promptDelete = async (c: any) => {
    const [{ count: productCount }, { count: subcatCount }] = await Promise.all([
      supabase.from("products").select("*", { count: "exact", head: true }).eq("category_id", c.id),
      supabase.from("categories").select("*", { count: "exact", head: true }).eq("parent_id", c.id),
    ]);

    setDeleteDialog({
      open: true,
      categoryId: c.id,
      categoryName: c.name,
      productCount: productCount || 0,
      subcatCount: subcatCount || 0,
    });
  };

  const confirmDelete = async () => {
    if (!deleteDialog.categoryId) return;

    if (deleteDialog.subcatCount > 0) {
      toast({
        title: "Cannot Delete Parent Category",
        description: `This category has ${deleteDialog.subcatCount} subcategory(ies). Please reassign or delete child categories first.`,
        variant: "destructive",
      });
      setDeleteDialog((prev) => ({ ...prev, open: false }));
      return;
    }

    setIsDeleting(true);

    // If products reference this category, safely unassign them first to maintain referential integrity
    if (deleteDialog.productCount > 0) {
      const { error: unassignError } = await supabase
        .from("products")
        .update({ category_id: null })
        .eq("category_id", deleteDialog.categoryId);

      if (unassignError) {
        setIsDeleting(false);
        toast({
          title: "Failed to unassign products",
          description: unassignError.message,
          variant: "destructive",
        });
        return;
      }
    }

    const { error } = await supabase.from("categories").delete().eq("id", deleteDialog.categoryId);
    setIsDeleting(false);
    setDeleteDialog((prev) => ({ ...prev, open: false }));

    if (error) {
      toast({ title: "Failed to delete category", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Category deleted",
        description: deleteDialog.productCount > 0
          ? `Category removed. ${deleteDialog.productCount} product(s) unassigned to Uncategorized.`
          : "Category deleted successfully.",
      });
      fetch();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-heading font-bold text-foreground">Categories</h2>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Add Category</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Slug</TableHead><TableHead>Order</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {items.map((c) => {
                const parent = items.find(x => x.id === c.parent_id);
                return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    {parent && <span className="text-muted-foreground mr-1">{parent.name} ›</span>}
                    {c.name}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.slug}</TableCell>
                  <TableCell>{c.sort_order}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => promptDelete(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editId ? "Edit" : "New"} Category</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
            <div>
              <Label>Parent Category (optional)</Label>
              <select value={form.parent_id} onChange={(e) => setForm({ ...form, parent_id: e.target.value })} className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground">
                <option value="">— Top level —</option>
                {items.filter(c => c.id !== editId && !c.parent_id).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div><Label>Image URL</Label><Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div><Label>Sort Order</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} /></div>
            <Button onClick={save} disabled={saving} className="w-full">
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : editId ? "Update Category" : "Create Category"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog((prev) => ({ ...prev, open }))}
        title={
          deleteDialog.subcatCount > 0
            ? `Cannot Delete Category "${deleteDialog.categoryName}"`
            : `Delete Category "${deleteDialog.categoryName}"`
        }
        description={
          deleteDialog.subcatCount > 0
            ? `This category cannot be deleted because it currently has ${deleteDialog.subcatCount} active subcategory(ies) assigned to it. Please reassign or delete the subcategories first before removing this parent category.`
            : deleteDialog.productCount > 0
            ? `Warning: This category currently has ${deleteDialog.productCount} assigned product(s).\n\nDeleting this category will safely unassign it from these ${deleteDialog.productCount} product(s) (marking them as Uncategorized). Historical orders will remain intact.\n\nAre you sure you want to proceed?`
            : `Are you sure you want to delete "${deleteDialog.categoryName}"? This action cannot be undone.`
        }
        confirmText={
          deleteDialog.subcatCount > 0
            ? "Blocked (Subcategories Exist)"
            : deleteDialog.productCount > 0
            ? "Unassign Products & Delete"
            : "Delete Category"
        }
        loading={isDeleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default AdminCategories;
