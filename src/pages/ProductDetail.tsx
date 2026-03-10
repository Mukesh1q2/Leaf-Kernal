import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { Star, ShoppingBag, Heart, Minus, Plus, ChevronRight, Truck, Shield, RotateCcw } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const ProductDetail = () => {
  const { slug } = useParams();
  const [product, setProduct] = useState<any>(null);
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState("description");
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      const { data } = await supabase.from("products").select("*").eq("slug", slug).single();
      if (data) {
        setProduct(data);
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

  const tabs = [
    { id: "description", label: "Description" },
    { id: "ingredients", label: "Ingredients" },
    { id: "how-to-use", label: "How to Use" },
    { id: "benefits", label: "Benefits" },
  ];

  return (
    <div className="min-h-screen bg-background">
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
            <div className="relative aspect-square bg-cream-dark rounded-2xl overflow-hidden">
              <img src={product.image_url || "/placeholder.svg"} alt={product.name} className="w-full h-full object-cover" />
              {product.badge && (
                <span className="absolute top-4 left-4 bg-secondary text-secondary-foreground text-sm font-bold px-3 py-1.5 rounded-full">{product.badge}</span>
              )}
            </div>

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
                      <img src={p.image_url || "/placeholder.svg"} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
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
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ProductDetail;
