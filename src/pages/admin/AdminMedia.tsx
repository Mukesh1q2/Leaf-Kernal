import { useEffect, useState, useRef, DragEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Image, Upload, Trash2, Copy, Check, Search, RefreshCw, Loader2, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface StorageFile {
  name: string;
  id: string;
  updated_at: string;
  created_at: string;
  last_accessed_at: string;
  metadata: {
    eTag: string;
    size: number;
    mimetype: string;
    cacheControl: string;
  };
}

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const AdminMedia = () => {
  const [files, setFiles] = useState<{ name: string; url: string; size: number; updated_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const fetchMedia = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.storage.from("product-images").list("uploads", {
        limit: 100,
        offset: 0,
        sortBy: { column: "created_at", order: "desc" },
      });

      if (error) {
        console.error("Fetch media error:", error);
        toast({ title: "Failed to load media", description: error.message, variant: "destructive" });
      } else if (data) {
        const fileList = data.map((f) => {
          const path = `uploads/${f.name}`;
          const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
          return {
            name: f.name,
            url: pub.publicUrl,
            size: f.metadata?.size || 0,
            updated_at: f.created_at || f.updated_at || new Date().toISOString(),
          };
        });
        setFiles(fileList);
      }
    } catch (e: any) {
      toast({ title: "Error loading media", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedia();
  }, []);

  const handleUpload = async (file: File) => {
    if (!ACCEPTED.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Only JPG, PNG, WebP, or AVIF allowed.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast({ title: "File too large", description: "Max file size is 5MB.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error } = await supabase.storage.from("product-images").upload(path, file, {
        upsert: false,
        contentType: file.type,
        cacheControl: "3600",
      });

      if (error) throw error;

      toast({ title: "Media uploaded successfully!" });
      fetchMedia();
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    toast({ title: "Copied URL to clipboard!" });
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const deleteMedia = async (fileName: string) => {
    if (!confirm(`Are you sure you want to delete ${fileName}?`)) return;
    try {
      const { error } = await supabase.storage.from("product-images").remove([`uploads/${fileName}`]);
      if (error) throw error;
      toast({ title: "Asset deleted" });
      fetchMedia();
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  };

  const filtered = files.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-heading font-bold text-foreground">Media Asset Library</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Manage uploaded images, product graphics, and banners.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchMedia} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Upload Media
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />
        </div>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`p-6 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 bg-card"
        }`}
      >
        <Upload className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm font-medium text-foreground">Drag & drop asset here or click to browse</p>
        <p className="text-xs text-muted-foreground mt-1">Supports JPG, PNG, WebP, AVIF up to 5MB</p>
      </div>

      {/* Search Filter */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter assets by name..."
          className="pl-10 max-w-md"
        />
      </div>

      {/* Asset Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-44 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Image className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p>No media assets found matching your filter.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map((file) => (
            <Card key={file.name} className="overflow-hidden group hover:shadow-md transition-shadow flex flex-col">
              <div className="aspect-square bg-muted relative overflow-hidden flex items-center justify-center">
                <img
                  src={file.url}
                  alt={file.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    onClick={() => copyUrl(file.url)}
                    className="p-1.5 rounded-md bg-background/90 hover:bg-background text-foreground transition-colors"
                    title="Copy Image URL"
                  >
                    {copiedUrl === file.url ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </button>
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-md bg-background/90 hover:bg-background text-foreground transition-colors"
                    title="Open Full Image"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <button
                    onClick={() => deleteMedia(file.name)}
                    className="p-1.5 rounded-md bg-background/90 hover:bg-background text-destructive transition-colors"
                    title="Delete Image"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="p-2.5 flex-1 flex flex-col justify-between text-xs">
                <p className="font-mono text-[11px] truncate text-foreground" title={file.name}>
                  {file.name}
                </p>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                  <span>{(file.size / 1024).toFixed(0)} KB</span>
                  <span>{format(new Date(file.updated_at), "MMM d")}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminMedia;
