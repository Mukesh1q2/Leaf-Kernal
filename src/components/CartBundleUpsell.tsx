import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles } from "lucide-react";

const CartBundleUpsell = () => {
  const [bundles, setBundles] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("product_bundles")
        .select("id,name,slug,image_url,bundle_price,original_total,description")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(2);
      setBundles(data || []);
    })();
  }, []);
  if (bundles.length === 0) return null;
  return (
    <div className="mt-6 p-4 rounded-xl border border-secondary/30 bg-secondary/5">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={16} className="text-secondary" />
        <h3 className="font-heading font-semibold text-sm">Super Saver Combos</h3>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {bundles.map((b) => {
          const savings = Number(b.original_total || 0) - Number(b.bundle_price || 0);
          const pct = b.original_total ? Math.round((savings / Number(b.original_total)) * 100) : 0;
          return (
            <Link key={b.id} to={`/shop?bundle=${b.slug}`} className="flex gap-3 p-3 bg-background rounded-lg hover:shadow-md transition-shadow">
              <img src={b.image_url || "/placeholder.svg"} alt={b.name} className="w-16 h-16 object-cover rounded-md" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold line-clamp-1">{b.name}</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="font-bold text-foreground">₹{Number(b.bundle_price).toFixed(0)}</span>
                  <span className="text-xs text-muted-foreground line-through">₹{Number(b.original_total).toFixed(0)}</span>
                </div>
                {savings > 0 && <p className="text-xs text-primary font-semibold mt-0.5">Save ₹{savings.toFixed(0)} ({pct}%)</p>}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default CartBundleUpsell;