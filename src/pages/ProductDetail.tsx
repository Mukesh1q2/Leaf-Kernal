import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { Star, ShoppingBag, Heart, Minus, Plus, ChevronRight, Truck, Shield, RotateCcw, RefreshCw, Loader2, Leaf, Sprout, BadgeCheck, HeartPulse } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { FrequentlyBoughtTogether } from "@/components/RecommendationWidgets";
import ProductReviews from "@/components/ProductReviews";
import { trackActivity } from "@/lib/activity";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscriptionDiscount, createSubscription } from "@/lib/subscriptions";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import PincodeChecker from "@/components/PincodeChecker";
import { DraftPreviewBanner } from "@/components/DraftPreviewBanner";
import { SEOHead } from "@/components/SEOHead";
import { generateProductSchema } from "@/lib/seo";
import ProductImage from "@/components/ProductImage";
import { getLocalFallbackImage } from "@/lib/productImages";

const ProductDetail = () => {
  const { slug } = useParams();
  const [product, setProduct] = useState<any>(null);
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState("description");
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const subDiscount = useSubscriptionDiscount();
  const [subscribeMode, setSubscribeMode] = useState(false);
  const [cadence, setCadence] = useState(30);
  const [subSaving, setSubSaving] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  const handleSubscribe = async () => {
    if (!user) { navigate("/auth"); return; }
    setSubSaving(true);
    try {
      await createSubscription({
        userId: user.id,
        productId: product.id,
        quantity,
        cadenceDays: cadence,
        discountPct: subDiscount,
      });
      trackActivity("subscribe", product.id, { cadence, quantity });
      toast({ title: "Subscription created!", description: `Renews every ${cadence} days. Manage it in My Account.` });
      setSubscribeMode(false);
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setSubSaving(false);
    }
  };

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      const { data } = await supabase.from("products").select("*").eq("slug", slug).single();
      if (data) {
        setProduct(data);
        setActiveImage(0);
        trackActivity("view", data.id, { slug: data.slug });
        const { data: related } = await supabase.from("products").select("*").eq("category_id", data.category_id).neq("id", data.id).limit(4);
        setRelatedProducts(related || []);
      }
      setLoading(false);
    };
    fetchProduct();
  }, [slug]);

  if (loading) return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-16"><div className="h-96 bg-muted rounded-xl animate-pulse" /></div>
      <Footer />
    </div>
  );

  if (!product) return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-16 text-center">
        <h1 className="text-2xl font-heading font-bold">Product not found</h1>
        <Link to="/shop" className="text-secondary hover:underline mt-4 inline-block">Back to Shop</Link>
      </div>
      <Footer />
    </div>
  );

  const discount = product.original_price ? Math.round((1 - product.price / product.original_price) * 100) : 0;

  const fallbackAsset = getLocalFallbackImage(product.slug || product.name);

  const gallery: string[] = [
    product.image_url,
    ...((product.gallery_urls as string[] | null) || []),
  ].filter((u): u is string => !!u);
  if (gallery.length === 0) gallery.push(fallbackAsset);
  const currentImage = gallery[Math.min(activeImage, gallery.length - 1)];

  const tabs = [
    { id: "description", label: "Description" },
    { id: "ingredients", label: "Ingredients" },
    { id: "how-to-use", label: "How to Use" },
    { id: "benefits", label: "Benefits" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={product.name}
        description={product.short_description || product.description}
        image={product.image_url}
        jsonLd={generateProductSchema(product)}
      />
      <DraftPreviewBanner />
      <Header />
      <main>
        <div className="container py-4">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-secondary">Home</Link>
            <ChevronRight size={14} />
            <Link to="/shop" className="hover:text-secondary">Shop</Link>
            <ChevronRight size={14} />
            <span className="text-foreground">{product.name}</span>
          </nav>
        </div>

        <div className="container pb-16">
          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            <div>
              <div className="relative aspect-square bg-cream-dark rounded-2xl overflow-hidden cursor-zoom-in group" onClick={() => setZoomed(true)}>
                <ProductImage
                  src={currentImage}
                  slug={product.slug}
                  name={product.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {product.badge && (
                  <span className="absolute top-4 left-4 bg-secondary text-secondary-foreground text-sm font-bold px-3 py-1.5 rounded-full">{product.badge}</span>
                )}
              </div>
              {gallery.length > 1 && (
                <div className="mt-3 grid grid-cols-5 sm:grid-cols-6 gap-2">
                  {gallery.map((url, i) => (
                    <button
                      key={url + i}
                      onClick={() => setActiveImage(i)}
                      className={`aspect-square rounded-lg overflow-hidden border-2 transition ${i === activeImage ? "border-secondary" : "border-transparent hover:border-border"}`}
                      aria-label={`View image ${i + 1}`}
                    >
                      <ProductImage
                        src={url}
                        slug={product.slug}
                        name={product.name}
                        imageIndex={i}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
            {zoomed && (
              <div onClick={() => setZoomed(false)} className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 cursor-zoom-out animate-fade-in">
                <ProductImage
                  src={currentImage}
                  slug={product.slug}
                  name={product.name}
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
              </div>
            )}

            <div>
              <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">{product.name}</h1>
              <p className="text-muted-foreground mt-2">{product.short_description}</p>

              <div className="flex items-center gap-2 mt-4">
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={18} className={i < Math.round(product.rating || 0) ? "fill-gold text-gold" : "text-border"} />
                  ))}
                </div>
                <span className="text-sm font-medium">{product.rating}</span>
                <span className="text-sm text-muted-foreground">({product.review_count} reviews)</span>
              </div>

              <div className="flex items-baseline gap-3 mt-6">
                <span className="text-3xl font-bold text-foreground">₹{product.price}</span>
                {product.original_price && (
                  <>
                    <span className="text-lg text-muted-foreground line-through">₹{product.original_price}</span>
                    <span className="text-sm font-semibold text-secondary bg-leaf/10 px-2 py-1 rounded">{discount}% OFF</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-4 mt-6">
                <span className="text-sm font-medium text-foreground">Quantity:</span>
                <div className="flex items-center border border-border rounded-lg">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-2 hover:bg-muted transition-colors"><Minus size={16} /></button>
                  <span className="px-4 text-sm font-medium">{quantity}</span>
                  <button onClick={() => setQuantity(quantity + 1)} className="p-2 hover:bg-muted transition-colors"><Plus size={16} /></button>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => addToCart(product.id, quantity)} className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-forest-light transition-colors">
                  <ShoppingBag size={20} /> Add to Cart
                </button>
                <button
                  onClick={() => toggleWishlist(product.id)}
                  className={`w-12 h-12 border rounded-lg flex items-center justify-center transition-colors ${isInWishlist(product.id) ? "border-destructive bg-destructive/10" : "border-border hover:bg-muted"}`}
                  aria-label="Toggle wishlist"
                >
                  <Heart size={20} className={isInWishlist(product.id) ? "fill-destructive text-destructive" : "text-foreground"} />
                </button>
              </div>

              <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { icon: Leaf, label: "100% Vegan" },
                  { icon: Sprout, label: "Ayurvedic" },
                  { icon: HeartPulse, label: "No Preservatives" },
                  { icon: BadgeCheck, label: "GMP Certified" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-leaf/5 border border-leaf/20">
                    <Icon size={16} className="text-secondary shrink-0" />
                    <span className="text-xs font-medium text-foreground">{label}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 border border-border rounded-xl p-4 bg-muted/40">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <RefreshCw size={18} className="text-secondary mt-0.5" />
                    <div>
                      <div className="font-semibold text-sm text-foreground">Subscribe & Save {subDiscount}%</div>
                      <div className="text-xs text-muted-foreground">Auto-deliver, pause anytime.</div>
                    </div>
                  </div>
                  {!subscribeMode ? (
                    <button onClick={() => setSubscribeMode(true)} className="text-xs font-semibold text-secondary hover:underline whitespace-nowrap">Set up</button>
                  ) : (
                    <button onClick={() => setSubscribeMode(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                  )}
                </div>
                {subscribeMode && (
                  <div className="mt-3 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {[15, 30, 60, 90].map((d) => (
                        <button key={d} onClick={() => setCadence(d)} className={`px-3 py-1.5 text-xs font-medium rounded-full border ${cadence === d ? "border-secondary bg-secondary text-secondary-foreground" : "border-border text-foreground hover:bg-muted"}`}>
                          Every {d} days
                        </button>
                      ))}
                    </div>
                    <button onClick={handleSubscribe} disabled={subSaving} className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-secondary text-secondary-foreground text-sm font-semibold rounded-lg hover:bg-leaf transition-colors disabled:opacity-50">
                      {subSaving ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                      Subscribe — Save ₹{Math.round((product.price * quantity * subDiscount) / 100)}/order
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-border">
                <div className="text-center">
                  <Truck size={24} className="text-secondary mx-auto mb-1" />
                  <span className="text-xs text-muted-foreground">Free Shipping 999+</span>
                </div>
                <div className="text-center">
                  <Shield size={24} className="text-secondary mx-auto mb-1" />
                  <span className="text-xs text-muted-foreground">100% Authentic</span>
                </div>
                <div className="text-center">
                  <RotateCcw size={24} className="text-secondary mx-auto mb-1" />
                  <span className="text-xs text-muted-foreground">30 Day Returns</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-border">
                <p className="text-xs font-medium text-muted-foreground mb-2">Check Delivery & COD Availability</p>
                <PincodeChecker />
              </div>
            </div>
          </div>

          <div className="mt-12">
            <div className="flex border-b border-border gap-0 overflow-x-auto">
              {tabs.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-6 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === tab.id ? "border-secondary text-secondary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="py-6 text-foreground leading-relaxed">
              {activeTab === "description" && <p>{product.description || "No description available."}</p>}
              {activeTab === "ingredients" && <p>{product.ingredients || "No ingredient information available."}</p>}
              {activeTab === "how-to-use" && <p>{product.how_to_use || "No usage instructions available."}</p>}
              {activeTab === "benefits" && <p>{product.benefits || "No benefits information available."}</p>}
            </div>
          </div>

          {relatedProducts.length > 0 && (
            <div className="mt-12">
              <h2 className="text-2xl font-heading font-bold text-foreground mb-6">You May Also Like</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {relatedProducts.map(p => (
                  <Link key={p.id} to={`/product/${p.slug}`} className="group bg-background rounded-xl border border-border overflow-hidden hover:shadow-lg transition-all">
                    <div className="aspect-square bg-cream-dark overflow-hidden">
                      <ProductImage
                        src={p.image_url}
                        slug={p.slug}
                        name={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                    <div className="p-3">
                      <h3 className="font-heading font-semibold text-sm text-foreground">{p.name}</h3>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="font-bold text-foreground">₹{p.price}</span>
                        {p.original_price && <span className="text-xs text-muted-foreground line-through">₹{p.original_price}</span>}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <FrequentlyBoughtTogether productId={product.id} />
          <ProductReviews productId={product.id} />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ProductDetail;
