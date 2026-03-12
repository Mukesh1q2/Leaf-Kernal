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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";

const emptyForm = { title: "", slug: "", excerpt: "", content: "", category: "", image_url: "", is_published: false };

const AdminBlog = () => {
  const [posts, setPosts] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const { toast } = useToast();

  const fetchPosts = async () => {
    const { data } = await supabase.from("blog_posts").select("*").order("created_at", { ascending: false });
    setPosts(data || []);
  };

  useEffect(() => { fetchPosts(); }, []);

  const openNew = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (p: any) => {
    setEditId(p.id);
    setForm({ title: p.title, slug: p.slug, excerpt: p.excerpt || "", content: p.content || "", category: p.category || "", image_url: p.image_url || "", is_published: p.is_published });
    setDialogOpen(true);
  };

  const save = async () => {
    const payload = { ...form, slug: form.slug || form.title.toLowerCase().replace(/\s+/g, "-"), published_at: form.is_published ? new Date().toISOString() : null };
    if (editId) {
      await supabase.from("blog_posts").update(payload).eq("id", editId);
      toast({ title: "Post updated" });
    } else {
      await supabase.from("blog_posts").insert(payload);
      toast({ title: "Post created" });
    }
    setDialogOpen(false);
    fetchPosts();
  };

  const togglePublish = async (id: string, current: boolean) => {
    await supabase.from("blog_posts").update({ is_published: !current, published_at: !current ? new Date().toISOString() : null }).eq("id", id);
    fetchPosts();
  };

  const deletePost = async (id: string) => {
    if (!confirm("Delete this post?")) return;
    await supabase.from("blog_posts").delete().eq("id", id);
    toast({ title: "Post deleted" });
    fetchPosts();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-heading font-bold text-foreground">Blog Posts</h2>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> New Post</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Published</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.category || "—"}</TableCell>
                  <TableCell><Switch checked={p.is_published} onCheckedChange={() => togglePublish(p.id, p.is_published)} /></TableCell>
                  <TableCell className="text-sm">{format(new Date(p.created_at), "MMM dd, yyyy")}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => deletePost(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit Post" : "New Post"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
            <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
            <div><Label>Excerpt</Label><Textarea value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} rows={2} /></div>
            <div><Label>Content</Label><Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={8} /></div>
            <div><Label>Image URL</Label><Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} /> Published</label>
            <Button onClick={save} className="w-full">{editId ? "Update" : "Create"} Post</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBlog;
