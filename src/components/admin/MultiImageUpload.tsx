import { useState, useRef, DragEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2, GripVertical } from "lucide-react";
import { toast } from "sonner";

interface Props {
  values: string[];
  onChange: (urls: string[]) => void;
  bucket?: string;
  folder?: string;
  max?: number;
}

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_BYTES = 5 * 1024 * 1024;

const MultiImageUpload = ({ values, onChange, bucket = "product-images", folder = "gallery", max = 10 }: Props) => {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = async (files: File[]) => {
    if (!files.length) return;
    if (values.length + files.length > max) {
      toast.error(`Maximum ${max} images allowed`);
      return;
    }
    setUploading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) { toast.error("Please sign in as an admin"); return; }
      const uploaded: string[] = [];
      for (const file of files) {
        if (!ACCEPTED.includes(file.type)) { toast.error(`${file.name}: unsupported type`); continue; }
        if (file.size > MAX_BYTES) { toast.error(`${file.name}: over 5 MB`); continue; }
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from(bucket).upload(path, file, {
          upsert: false, contentType: file.type, cacheControl: "3600",
        });
        if (error) { toast.error(`${file.name}: ${error.message}`); continue; }
        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
        uploaded.push(pub.publicUrl);
      }
      if (uploaded.length) {
        onChange([...values, ...uploaded]);
        toast.success(`Uploaded ${uploaded.length} image${uploaded.length > 1 ? "s" : ""}`);
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = (idx: number) => onChange(values.filter((_, i) => i !== idx));

  const move = (from: number, to: number) => {
    if (to < 0 || to >= values.length) return;
    const next = [...values];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    uploadFiles(Array.from(e.dataTransfer.files || []));
  };

  return (
    <div className="space-y-3">
      {values.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {values.map((url, idx) => (
            <div key={url + idx} className="relative group aspect-square border border-border rounded-md overflow-hidden bg-muted">
              <img src={url} alt={`Image ${idx + 1}`} className="w-full h-full object-cover" />
              {idx === 0 && (
                <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-[10px] font-semibold px-1.5 py-0.5 rounded">Cover</span>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                <button type="button" onClick={() => move(idx, idx - 1)} className="text-white text-xs px-1.5 py-0.5 bg-black/40 rounded" title="Move left">←</button>
                <button type="button" onClick={() => move(idx, idx + 1)} className="text-white text-xs px-1.5 py-0.5 bg-black/40 rounded" title="Move right">→</button>
                <button type="button" onClick={() => remove(idx)} className="text-white text-xs p-1 bg-red-600/80 rounded" title="Remove"><X className="h-3 w-3" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`w-full h-24 rounded-md border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
      >
        {uploading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <>
            <Upload className="h-5 w-5 text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">Drop images or click — add 4–6+ angles ({values.length}/{max})</p>
            <p className="text-[10px] text-muted-foreground/70">JPG · PNG · WebP · AVIF · max 5 MB each</p>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED.join(",")}
        className="hidden"
        onChange={(e) => uploadFiles(Array.from(e.target.files || []))}
      />
    </div>
  );
};

export default MultiImageUpload;