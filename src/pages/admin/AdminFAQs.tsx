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
import { Plus, Pencil, Trash2 } from "lucide-react";

const emptyForm = { question: "", answer: "", category: "General", sort_order: "0", is_active: true };

const AdminFAQs = () => {
  const [faqs, setFaqs] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const { toast } = useToast();

  const fetchFaqs = async () => {
    const { data } = await supabase.from("faqs").select("*").order("sort_order");
    setFaqs(data || []);
  };

  useEffect(() => { fetchFaqs(); }, []);

  const openNew = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (f: any) => {
    setEditId(f.id);
    setForm({ question: f.question, answer: f.answer, category: f.category || "General", sort_order: String(f.sort_order || 0), is_active: f.is_active });
    setDialogOpen(true);
  };

  const save = async () => {
    const payload = { ...form, sort_order: parseInt(form.sort_order) || 0 };
    if (editId) {
      await supabase.from("faqs").update(payload).eq("id", editId);
      toast({ title: "FAQ updated" });
    } else {
      await supabase.from("faqs").insert(payload);
      toast({ title: "FAQ created" });
    }
    setDialogOpen(false);
    fetchFaqs();
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from("faqs").update({ is_active: !current }).eq("id", id);
    fetchFaqs();
  };

  const deleteFaq = async (id: string) => {
    if (!confirm("Delete this FAQ?")) return;
    await supabase.from("faqs").delete().eq("id", id);
    toast({ title: "FAQ deleted" });
    fetchFaqs();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-heading font-bold text-foreground">FAQs</h2>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Add FAQ</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Question</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Order</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {faqs.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium max-w-xs truncate">{f.question}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{f.category}</TableCell>
                  <TableCell><Switch checked={f.is_active} onCheckedChange={() => toggleActive(f.id, f.is_active)} /></TableCell>
                  <TableCell>{f.sort_order}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(f)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteFaq(f.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? "Edit FAQ" : "New FAQ"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Question</Label><Input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} /></div>
            <div><Label>Answer</Label><Textarea value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} rows={4} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
              <div><Label>Sort Order</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
            <Button onClick={save} className="w-full">{editId ? "Update" : "Create"} FAQ</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminFAQs;
