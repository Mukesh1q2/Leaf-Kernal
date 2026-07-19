import { useState, useRef, DragEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  bucket?: string;
  folder?: string;
}

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const ImageUpload = ({ value, onChange, bucket = "product-images", folder = "uploads" }: ImageUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = (file: File): string | null => {
    if (!ACCEPTED.includes(file.type)) return "Only JPG, PNG, WebP or AVIF images are allowed";
    if (file.size > MAX_BYTES) return `File too large (max ${MAX_BYTES / 1024 / 1024} MB)`;
    return null;
  };

  const upload = async (file: File) => {
    const invalid = validate(file);
    if (invalid) {
      toast.error(invalid);
      return;
    }

    setUploading(true);
    try {
      // Guard: must be authenticated as admin (storage RLS requires it)
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        toast.error("Please sign in as an admin to upload images");
        return;
      }

      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        upsert: false,
        contentType: file.type,
        cacheControl: "3600",
      });

      if (error) {
        console.error("Upload error:", error);
        toast.error(error.message || "Upload failed");
        return;
      }

      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
      onChange(pub.publicUrl);
      toast.success("Image uploaded");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Upload failed");
    } finally {
      setUploading(false);
      // Allow re-selecting the same file
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) upload(file);
  };

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative w-full h-40 rounded-md overflow-hidden border border-border bg-muted">
          <img src={value} alt="Preview" className="w-full h-full object-contain" />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute top-1 right-1 bg-background/90 rounded-full p-1 hover:bg-background"
            aria-label="Remove image"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`w-full h-32 rounded-md border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
          }`}
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <>
              <Upload className="h-6 w-6 text-muted-foreground mb-1" />
              <p className="text-xs text-muted-foreground">Drop image or click to upload</p>
              <p className="text-[10px] text-muted-foreground/70">JPG, PNG, WebP, AVIF · max 5 MB</p>
            </>
          )}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          placeholder="…or paste image URL"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1"
        />
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
        />
        <Button type="button" variant="outline" size="icon" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
};

export default ImageUpload;
