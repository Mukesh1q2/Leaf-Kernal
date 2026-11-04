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
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

const emptyForm = { question: "", answer: "", category: "General", sort_order: "0", is_active: true };

const AdminFAQs = () => {
  const [faqs, setFaqs] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; faqId: string | null; question: string }>({
    open: false,
    faqId: null,
    question: "",
  });
  const { toast } = useToast();

  const fetchFaqs = async () => {
    const { data, error } = await supabase.from("faqs").select("*").order("sort_order");
    if (error) {
      toast({ title: "Failed to load FAQs", description: error.message, variant: "destructive" });
    } else {
      setFaqs(data || []);
    }
  };

  useEffect(() => { fetchFaqs(); }, []);

  const openNew = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (f: any) => {
    setEditId(f.id);
    setForm({
      question: f.question,
      answer: f.answer,
      category: f.category || "General",
      sort_order: String(f.sort_order || 0),
      is_active: f.is_active ?? true,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.question.trim()) {
      toast({ title: "Question required", description: "Please enter a question.", variant: "destructive" });
      return;
    }
    if (!form.answer.trim()) {
      toast({ title: "Answer required", description: "Please enter an answer.", variant: "destructive" });
      return;
    }
    const sortOrder = parseInt(form.sort_order, 10);

    setSaving(true);
    const payload = {
      question: form.question.trim(),
      answer: form.answer.trim(),
      category: form.category?.trim() || "General",
      sort_order: isNaN(sortOrder) ? 0 : sortOrder,
      is_active: form.is_active,
    };

    if (editId) {
      const { error } = await supabase.from("faqs").update(payload).eq("id", editId);
      if (error) {
        setSaving(false);
        toast({ title: "Failed to update FAQ", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "FAQ updated successfully" });
    } else {
      const { error } = await supabase.from("faqs").insert(payload);
      if (error) {
        setSaving(false);
        toast({ title: "Failed to create FAQ", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "FAQ created successfully" });
    }

    setSaving(false);
    setDialogOpen(false);
    fetchFaqs();
  };

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from("faqs").update({ is_active: !current }).eq("id", id);
    if (error) {
      toast({ title: "Failed to update status", description: error.message, variant: "destructive" });
    } else {
      toast({ title: !current ? "FAQ activated" : "FAQ deactivated" });
      fetchFaqs();
    }
  };

  const promptDeleteFaq = (f: any) => {
    setDeleteDialog({
      open: true,
      faqId: f.id,
      question: f.question,
    });
  };

  const confirmDeleteFaq = async () => {
    if (!deleteDialog.faqId) return;
    setIsDeleting(true);

    const { error } = await supabase.from("faqs").delete().eq("id", deleteDialog.faqId);
    setIsDeleting(false);
    setDeleteDialog(prev => ({ ...prev, open: false }));

    if (error) {
      toast({ title: "Failed to delete FAQ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "FAQ deleted successfully" });
      fetchFaqs();
    }
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
                    <Button variant="ghost" size="icon" onClick={() => promptDeleteFaq(f)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
            <div><Label>Question</Label><Input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} placeholder="e.g. How should I take Ashwagandha?" /></div>
            <div><Label>Answer</Label><Textarea value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} rows={4} placeholder="Answer details..." /></div>
            <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="General, Shipping, Quality" /></div>
            <div><Label>Sort Order</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} /></div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              Active on Storefront
            </label>
            <Button onClick={save} disabled={saving} className="w-full">
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : editId ? "Update FAQ" : "Create FAQ"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}
        title="Delete FAQ"
        description={`Are you sure you want to delete this FAQ?\n\n"${deleteDialog.question}"`}
        confirmText="Delete FAQ"
        loading={isDeleting}
        onConfirm={confirmDeleteFaq}
      />
    </div>
  );
};

export default AdminFAQs;
