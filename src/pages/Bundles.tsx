import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Package, ShoppingBag, Sparkles, Check, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface BundleItemWithProduct {
  id: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    price: number;
    image_url: string | null;
    slug: string;
  };
}

interface BundleWithItems {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  bundle_price: number;
  original_total: number;
  is_active: boolean;
  items: BundleItemWithProduct[];
}

const Bundles = () => {
  const [bundles, setBundles] = useState<BundleWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const { addToCart } = useCart();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Fetch active bundles
        const { data: bData, error: bError } = await supabase
          .from("product_bundles")
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: false });

        if (bError || !bData) {
          if (mounted) setLoading(false);
          return;
        }

        // Fetch bundle items with product relations
        const bundleIds = bData.map((b) => b.id);
        const { data: itemsData, error: iError } = await supabase
          .from("bundle_items")
          .select("id, bundle_id, quantity, products(id, name, price, image_url, slug)")
          .in("bundle_id", bundleIds);

        if (iError || !itemsData) {
          if (mounted) {
            setBundles(bData.map((b) => ({ ...b, items: [] })));
            setLoading(false);
          }
          return;
        }

        const itemsByBundle = new Map<string, BundleItemWithProduct[]>();
        itemsData.forEach((row: any) => {
          if (row.products) {
            const list = itemsByBundle.get(row.bundle_id) || [];
            list.push({
              id: row.id,
              quantity: row.quantity || 1,
              product: row.products,
            });
            itemsByBundle.set(row.bundle_id, list);
          }
        });

        const combined: BundleWithItems[] = bData.map((b) => ({
          ...b,
          items: itemsByBundle.get(b.id) || [],
        }));

        if (mounted) {
          setBundles(combined);
          setLoading(false);
        }
      } catch (e) {
        console.warn("Error loading bundles:", e);
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const handleAddBundleToCart = async (bundle: BundleWithItems) => {
    if (bundle.items.length === 0) {
      toast.error("This bundle is currently unavailable.");
      return;
    }

    setAddingId(bundle.id);
    try {
      for (const item of bundle.items) {
        await addToCart(item.product.id, item.quantity);
      }
      toast.success(`Added ${bundle.name} (${bundle.items.length} items) to your cart! 🌿`);
    } catch {
      toast.error("Could not add bundle to cart. Please try again.");
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Super Saver Bundles & Combos"
        description="Discover curated Ayurvedic superfood combos and daily wellness bundles. Save more with plant-powered nutrition sets."
        url="https://leafandkernel.com/bundles"
      />
      <Header />

      <main>
        {/* Banner */}
        <div className="bg-primary py-12 text-center text-primary-foreground">
          <div className="container">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase text-leaf-light bg-leaf-light/10 px-3 py-1 rounded-full mb-3">
              <Sparkles size={14} /> Value Packs &amp; Wellness Routines
            </span>
            <h1 className="text-3xl md:text-4xl font-heading font-bold">
              Curated Superfood Combos
            </h1>
            <p className="text-primary-foreground/80 mt-2 max-w-lg mx-auto text-sm md:text-base">
              Synergistic Ayurvedic combinations crafted for daily health routines — with built-in bundle savings.
            </p>
          </div>
        </div>

        <div className="container py-8 md:py-12">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground mb-8">
            <Link to="/" className="hover:text-secondary">Home</Link>
            <ChevronRight size={14} />
            <Link to="/shop" className="hover:text-secondary">Shop</Link>
            <ChevronRight size={14} />
            <span className="text-foreground font-medium">Bundles &amp; Combos</span>
          </nav>

          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-96 bg-muted rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : bundles.length === 0 ? (
            <div className="text-center py-16 bg-muted/50 rounded-2xl max-w-md mx-auto p-8 border border-border">
              <Package size={48} className="text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-heading font-bold text-foreground">No Active Combos Currently</h2>
              <p className="text-muted-foreground text-sm mt-2">
                Our seasonal bundles are being updated. Explore our full catalog of single-origin superfoods in the shop.
              </p>
              <Link
                to="/shop"
                className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 bg-secondary text-secondary-foreground font-semibold rounded-lg hover:bg-leaf transition-colors text-sm"
              >
                Explore Single Superfoods
              </Link>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {bundles.map((bundle, i) => {
                const savings = Math.max(0, Number(bundle.original_total) - Number(bundle.bundle_price));
                const discountPct = bundle.original_total > 0 ? Math.round((savings / Number(bundle.original_total)) * 100) : 0;
                const isAdding = addingId === bundle.id;

                return (
                  <motion.div
                    key={bundle.id}
                    id={bundle.slug}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Image & Discount Badge */}
                      <div className="relative aspect-video bg-muted overflow-hidden">
                        <img
                          src={bundle.image_url || "/placeholder.svg"}
                          alt={bundle.name}
                          className="w-full h-full object-cover"
                        />
                        {discountPct > 0 && (
                          <span className="absolute top-3 left-3 bg-secondary text-secondary-foreground text-xs font-bold px-3 py-1 rounded-full shadow-md">
                            Save {discountPct}% (₹{savings.toFixed(0)})
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="p-6">
                        <h2 className="text-xl font-heading font-bold text-foreground mb-2">
                          {bundle.name}
                        </h2>
                        {bundle.description && (
                          <p className="text-muted-foreground text-xs md:text-sm line-clamp-2 mb-4">
                            {bundle.description}
                          </p>
                        )}

                        {/* Included Products List */}
                        {bundle.items.length > 0 && (
                          <div className="border-t border-border pt-4 mb-4">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                              Included in this Combo:
                            </p>
                            <ul className="space-y-2">
                              {bundle.items.map((item) => (
                                <li key={item.id} className="flex items-center justify-between text-xs text-foreground">
                                  <div className="flex items-center gap-2 truncate pr-2">
                                    <Check size={14} className="text-secondary shrink-0" />
                                    <span className="truncate">{item.product.name}</span>
                                  </div>
                                  <span className="text-muted-foreground font-medium shrink-0">
                                    Qty: {item.quantity}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Price and CTA */}
                    <div className="p-6 pt-0 border-t border-border mt-auto">
                      <div className="flex items-baseline justify-between py-4">
                        <div>
                          <span className="text-xs text-muted-foreground block">Combo Price</span>
                          <span className="text-2xl font-bold font-heading text-primary">
                            ₹{Number(bundle.bundle_price).toFixed(0)}
                          </span>
                        </div>
                        {bundle.original_total > bundle.bundle_price && (
                          <div className="text-right">
                            <span className="text-xs text-muted-foreground block">Standard Price</span>
                            <span className="text-sm text-muted-foreground line-through">
                              ₹{Number(bundle.original_total).toFixed(0)}
                            </span>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddBundleToCart(bundle)}
                        disabled={isAdding}
                        className="w-full py-3 bg-secondary text-secondary-foreground font-semibold rounded-lg hover:bg-leaf transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 text-sm"
                      >
                        {isAdding ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            Adding to Cart...
                          </>
                        ) : (
                          <>
                            <ShoppingBag size={16} />
                            Add Bundle to Cart
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Bundles;

