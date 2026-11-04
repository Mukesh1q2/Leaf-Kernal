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
import { Plus, Pencil, Trash2, Heart, Loader2 } from "lucide-react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Switch } from "@/components/ui/switch";
import { validateHealthConcernInput, generateSlug } from "@/lib/cmsValidation";

const emptyForm = { name: "", slug: "", description: "", icon: "", sort_order: "0", is_active: true };

const AdminHealthConcerns = () => {
  const [items, setItems] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    concernId: string | null;
    concernName: string;
    productCount: number;
  }>({
    open: false,
    concernId: null,
    concernName: "",
    productCount: 0,
  });
  const { toast } = useToast();

  const fetchData = async () => {
    const { data, error } = await supabase.from("health_concerns").select("*").order("sort_order");
    if (error) {
      toast({ title: "Failed to load health concerns", description: error.message, variant: "destructive" });
    } else {
      setItems(data || []);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openNew = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (c: any) => {
    setEditId(c.id);
    setForm({
      name: c.name,
      slug: c.slug,
      description: c.description || "",
      icon: c.icon || "",
      sort_order: String(c.sort_order || 0),
      is_active: c.is_active ?? true,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    const slug = generateSlug(form.slug || form.name);
    const validation = validateHealthConcernInput(form.name, slug);
    if (!validation.valid) {
      toast({ title: "Validation Error", description: validation.error, variant: "destructive" });
      return;
    }
    const sortOrder = parseInt(form.sort_order, 10);

    setSaving(true);
    const payload: any = {
      name: form.name.trim(),
      slug,
      description: form.description?.trim() || null,
      icon: form.icon?.trim() || null,
      sort_order: isNaN(sortOrder) ? 0 : sortOrder,
      is_active: form.is_active,
    };

    if (editId) {
      const { error } = await supabase.from("health_concerns").update(payload).eq("id", editId);
      if (error) {
        setSaving(false);
        toast({ title: "Failed to update health concern", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Health concern updated successfully" });
    } else {
      const { error } = await supabase.from("health_concerns").insert(payload);
      if (error) {
        setSaving(false);
        toast({ title: "Failed to create health concern", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Health concern created successfully" });
    }

    setSaving(false);
    setDialogOpen(false);
    fetchData();
  };

  const promptDelete = async (c: any) => {
    const { count } = await supabase
      .from("product_health_concerns")
      .select("*", { count: "exact", head: true })
      .eq("concern_id", c.id);

    setDeleteDialog({
      open: true,
      concernId: c.id,
      concernName: c.name,
      productCount: count || 0,
    });
  };

  const confirmDelete = async () => {
    if (!deleteDialog.concernId) return;
    setIsDeleting(true);

    // Call atomic health concern delete RPC which unlinks junction rows and deletes concern transactionally
    const { error: rpcError } = await (supabase.rpc as any)("delete_health_concern_atomic", {
      p_concern_id: deleteDialog.concernId,
    });

    setIsDeleting(false);
    setDeleteDialog(prev => ({ ...prev, open: false }));

    if (rpcError) {
      toast({ title: "Failed to delete health concern", description: rpcError.message, variant: "destructive" });
      return;
    }

    toast({
      title: "Health concern deleted",
      description: deleteDialog.productCount > 0
        ? `Concern deleted and safely unlinked from ${deleteDialog.productCount} product(s).`
        : "Health concern deleted successfully.",
    });
    fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Heart className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-heading font-bold text-foreground">Health Concerns</h2>
        </div>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Add Concern</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Slug</TableHead><TableHead>Icon</TableHead><TableHead>Order</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.slug}</TableCell>
                  <TableCell className="text-sm">{c.icon || "—"}</TableCell>
                  <TableCell>{c.sort_order}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => promptDelete(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editId ? "Edit" : "New"} Health Concern</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Immunity" /></div>
            <div><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="immunity" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div><Label>Icon (emoji or icon name)</Label><Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="🛡️ or Shield" /></div>
            <div><Label>Sort Order</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} /></div>
            <div className="flex items-center justify-between pt-2">
              <Label htmlFor="concern-active" className="cursor-pointer">Active on Storefront</Label>
              <Switch
                id="concern-active"
                checked={form.is_active}
                onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
              />
            </div>
            <Button onClick={save} disabled={saving} className="w-full">
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : editId ? "Update Concern" : "Create Concern"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}
        title={`Delete Health Concern "${deleteDialog.concernName}"`}
        description={
          deleteDialog.productCount > 0
            ? `Warning: This health concern is currently linked to ${deleteDialog.productCount} product(s).\n\nDeleting this concern will automatically and safely unlink it from these ${deleteDialog.productCount} product(s). Are you sure you want to proceed?`
            : `Are you sure you want to delete "${deleteDialog.concernName}"? This action cannot be undone.`
        }
        confirmText={
          deleteDialog.productCount > 0
            ? "Unlink Products & Delete"
            : "Delete Concern"
        }
        loading={isDeleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default AdminHealthConcerns;
