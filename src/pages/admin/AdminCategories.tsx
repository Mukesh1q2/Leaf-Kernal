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
import { Plus, Pencil, Trash2 } from "lucide-react";

const emptyForm = { name: "", slug: "", description: "", sort_order: "0" };

const AdminCategories = () => {
  const [items, setItems] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const { toast } = useToast();

  const fetch = async () => {
    const { data } = await supabase.from("categories").select("*").order("sort_order");
    setItems(data || []);
  };
  useEffect(() => { fetch(); }, []);

  const openNew = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (c: any) => {
    setEditId(c.id);
    setForm({ name: c.name, slug: c.slug, description: c.description || "", sort_order: String(c.sort_order || 0) });
    setDialogOpen(true);
  };

  const save = async () => {
    const payload = { name: form.name, slug: form.slug || form.name.toLowerCase().replace(/\s+/g, "-"), description: form.description || null, sort_order: parseInt(form.sort_order) || 0 };
    if (editId) {
      await supabase.from("categories").update(payload).eq("id", editId);
      toast({ title: "Category updated" });
    } else {
      await supabase.from("categories").insert(payload);
      toast({ title: "Category created" });
    }
    setDialogOpen(false);
    fetch();
  };

  const del = async (id: string) => {
    if (!confirm("Delete this category?")) return;
    await supabase.from("categories").delete().eq("id", id);
    toast({ title: "Category deleted" });
    fetch();
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
              {items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.slug}</TableCell>
                  <TableCell>{c.sort_order}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => del(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
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
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div><Label>Sort Order</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} /></div>
            <Button onClick={save} className="w-full">{editId ? "Update" : "Create"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCategories;
