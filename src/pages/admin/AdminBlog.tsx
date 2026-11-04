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
import { Plus, Pencil, Trash2, History, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { saveRevision } from "@/lib/revisions";
import { RevisionHistoryDialog } from "@/components/admin/RevisionHistoryDialog";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

const emptyForm = { title: "", slug: "", excerpt: "", content: "", category: "", image_url: "", is_published: false, scheduled_at: "" };

const AdminBlog = () => {
  const [posts, setPosts] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; postId: string | null; postTitle: string }>({
    open: false,
    postId: null,
    postTitle: "",
  });
  const { toast } = useToast();

  const fetchPosts = async () => {
    const { data, error } = await supabase.from("blog_posts").select("*").order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Failed to load blog posts", description: error.message, variant: "destructive" });
    } else {
      setPosts(data || []);
    }
  };

  useEffect(() => { fetchPosts(); }, []);

  const openNew = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (p: any) => {
    setEditId(p.id);
    setForm({
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt || "",
      content: p.content || "",
      category: p.category || "",
      image_url: p.image_url || "",
      is_published: p.is_published,
      scheduled_at: p.scheduled_at ? new Date(p.scheduled_at).toISOString().slice(0, 16) : "",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) {
      toast({ title: "Title required", description: "Please enter a blog post title.", variant: "destructive" });
      return;
    }
    const slug = (form.slug.trim() || form.title.trim()).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!slug) {
      toast({ title: "Invalid slug", description: "Slug must contain valid alphanumeric characters.", variant: "destructive" });
      return;
    }

    let scheduledAtIso: string | null = null;
    if (form.scheduled_at) {
      const parsedDate = new Date(form.scheduled_at);
      if (isNaN(parsedDate.getTime())) {
        toast({ title: "Invalid scheduled date", description: "Please select a valid date/time.", variant: "destructive" });
        return;
      }
      scheduledAtIso = parsedDate.toISOString();
    }

    setSaving(true);
    const payload = {
      title: form.title.trim(),
      slug,
      excerpt: form.excerpt?.trim() || null,
      content: form.content || "",
      category: form.category?.trim() || null,
      image_url: form.image_url?.trim() || null,
      is_published: form.is_published,
      published_at: form.is_published ? new Date().toISOString() : null,
      scheduled_at: scheduledAtIso,
    };

    if (editId) {
      const { error } = await supabase.from("blog_posts").update(payload).eq("id", editId);
      if (error) {
        setSaving(false);
        toast({ title: "Failed to update blog post", description: error.message, variant: "destructive" });
        return;
      }
      saveRevision("blog_post", editId, payload.title, payload);
      toast({ title: "Post updated successfully" });
    } else {
      const { data, error } = await supabase.from("blog_posts").insert(payload).select().single();
      if (error) {
        setSaving(false);
        toast({ title: "Failed to create blog post", description: error.message, variant: "destructive" });
        return;
      }
      if (data) saveRevision("blog_post", data.id, payload.title, payload);
      toast({ title: "Post created successfully" });
    }

    setSaving(false);
    setDialogOpen(false);
    fetchPosts();
  };

  const togglePublish = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from("blog_posts")
      .update({ is_published: !current, published_at: !current ? new Date().toISOString() : null })
      .eq("id", id);

    if (error) {
      toast({ title: "Failed to toggle status", description: error.message, variant: "destructive" });
    } else {
      toast({ title: !current ? "Post published live" : "Post moved to drafts" });
      fetchPosts();
    }
  };

  const promptDeletePost = (p: any) => {
    setDeleteDialog({
      open: true,
      postId: p.id,
      postTitle: p.title,
    });
  };

  const confirmDeletePost = async () => {
    if (!deleteDialog.postId) return;
    setIsDeleting(true);

    const { error } = await supabase.from("blog_posts").delete().eq("id", deleteDialog.postId);
    setIsDeleting(false);
    setDeleteDialog(prev => ({ ...prev, open: false }));

    if (error) {
      toast({ title: "Failed to delete post", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Post deleted successfully" });
      fetchPosts();
    }
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
                  <TableCell className="text-sm">{p.created_at ? format(new Date(p.created_at), "MMM dd, yyyy") : "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => promptDeletePost(p)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle>{editId ? "Edit Post" : "New Post"}</DialogTitle>
            {editId && (
              <Button type="button" variant="outline" size="sm" onClick={() => setHistoryOpen(true)} className="gap-1 text-xs">
                <History className="h-3.5 w-3.5" /> Revisions
              </Button>
            )}
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Blog post title" /></div>
            <div><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="blog-post-slug" /></div>
            <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Wellness, Recipes" /></div>
            <div><Label>Excerpt</Label><Textarea value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} rows={2} placeholder="Brief summary of the article" /></div>
            <div><Label>Content</Label><RichTextEditor content={form.content} onChange={(html) => setForm({ ...form, content: html })} placeholder="Write your blog post..." /></div>
            <div><Label>Image URL</Label><Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." /></div>
            <div><Label>Schedule Publish</Label><Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} /><p className="text-xs text-muted-foreground mt-1">Leave empty to publish immediately when toggled</p></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} /> Published</label>
            <Button onClick={save} disabled={saving} className="w-full">
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : editId ? "Update Post" : "Create Post"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <RevisionHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        entityType="blog_post"
        entityId={editId}
        onRestore={(payload) => {
          setForm({
            title: payload.title || "",
            slug: payload.slug || "",
            excerpt: payload.excerpt || "",
            content: payload.content || "",
            category: payload.category || "",
            image_url: payload.image_url || "",
            is_published: payload.is_published ?? false,
            scheduled_at: payload.scheduled_at ? new Date(payload.scheduled_at).toISOString().slice(0, 16) : "",
          });
          toast({ title: "Restored blog post draft from revision" });
        }}
      />

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}
        title={`Delete Post "${deleteDialog.postTitle}"`}
        description={`Are you sure you want to delete "${deleteDialog.postTitle}"? This action cannot be undone.`}
        confirmText="Delete Post"
        loading={isDeleting}
        onConfirm={confirmDeletePost}
      />
    </div>
  );
};

export default AdminBlog;
