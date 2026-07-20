import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Star, Loader2, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props { productId: string }

const ProductReviews = ({ productId }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [canReview, setCanReview] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("reviews")
      .select("id, rating, title, content, created_at, user_id, profiles:user_id(full_name)")
      .eq("product_id", productId)
      .eq("is_approved", true)
      .order("created_at", { ascending: false });
    setReviews(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [productId]);

  useEffect(() => {
    if (!user) { setCanReview(false); setAlreadyReviewed(false); return; }
    (async () => {
      const { data: mine } = await supabase.from("reviews").select("id").eq("user_id", user.id).eq("product_id", productId).maybeSingle();
      setAlreadyReviewed(!!mine);
      const { data: purchased } = await supabase
        .from("order_items")
        .select("order_id, orders!inner(user_id,status)")
        .eq("product_id", productId)
        .eq("orders.user_id", user.id)
        .eq("orders.status", "delivered")
        .limit(1);
      setCanReview((purchased || []).length > 0 && !mine);
    })();
  }, [user, productId]);

  const submit = async () => {
    if (!user) return;
    if (rating < 1 || rating > 5) return;
    if (content.trim().length < 10) { toast({ title: "Review too short", description: "Please write at least 10 characters.", variant: "destructive" }); return; }
    setSubmitting(true);
    const { error } = await supabase.from("reviews").insert({
      product_id: productId, user_id: user.id, rating, title: title.trim() || null, content: content.trim(),
    });
    setSubmitting(false);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Review submitted", description: "Pending admin approval. You'll earn loyalty points once approved." });
    setTitle(""); setContent(""); setRating(5); setAlreadyReviewed(true); setCanReview(false);
  };

  return (
    <section className="mt-12">
      <h2 className="text-2xl font-heading font-bold text-foreground mb-6">Verified Reviews</h2>

      {user && canReview && (
        <div className="border border-border rounded-xl p-4 mb-6 bg-muted/30">
          <div className="flex items-center gap-2 text-sm font-semibold text-secondary mb-3">
            <ShieldCheck size={16} /> You bought this — share your experience
          </div>
          <div className="flex gap-1 mb-3">
            {[1,2,3,4,5].map(n => (
              <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} stars`}>
                <Star size={22} className={n <= rating ? "fill-gold text-gold" : "text-border"} />
              </button>
            ))}
          </div>
          <input value={title} onChange={e => setTitle(e.target.value)} maxLength={100} placeholder="Title (optional)" className="w-full mb-2 px-3 py-2 border border-border rounded-lg bg-background text-sm" />
          <textarea value={content} onChange={e => setContent(e.target.value)} maxLength={1000} rows={3} placeholder="What did you love? How did it help?" className="w-full mb-3 px-3 py-2 border border-border rounded-lg bg-background text-sm" />
          <button onClick={submit} disabled={submitting} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-forest-light disabled:opacity-50">
            {submitting && <Loader2 size={14} className="animate-spin" />} Submit review
          </button>
        </div>
      )}
      {user && !canReview && !alreadyReviewed && (
        <p className="text-sm text-muted-foreground mb-6">Only verified purchasers can review. Once your order is delivered, come back to share your experience.</p>
      )}
      {user && alreadyReviewed && (
        <p className="text-sm text-muted-foreground mb-6">Thanks — you've already reviewed this product.</p>
      )}
      {!user && (
        <p className="text-sm text-muted-foreground mb-6">Sign in to leave a verified review.</p>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : reviews.length === 0 ? (
        <p className="text-muted-foreground text-sm">No reviews yet — be the first!</p>
      ) : (
        <div className="space-y-4">
          {reviews.map(r => (
            <div key={r.id} className="border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={14} className={i < r.rating ? "fill-gold text-gold" : "text-border"} />
                  ))}
                </div>
                <span className="text-sm font-semibold text-foreground">{r.profiles?.full_name || "Verified buyer"}</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-secondary bg-leaf/10 px-1.5 py-0.5 rounded"><ShieldCheck size={10}/> Verified</span>
                <span className="text-xs text-muted-foreground ml-auto">{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
              {r.title && <p className="font-semibold text-foreground text-sm mt-1">{r.title}</p>}
              {r.content && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{r.content}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default ProductReviews;