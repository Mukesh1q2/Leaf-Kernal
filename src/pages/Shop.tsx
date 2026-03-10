import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Star, ShoppingBag, Filter, X, Heart } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

interface Product {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  price: number;
  original_price: number | null;
  image_url: string | null;
  badge: string | null;
  rating: number | null;
  review_count: number | null;
  category_id: string | null;
}

interface Category { id: string; name: string; slug: string; }
interface HealthConcern { id: string; name: string; slug: string; }

const Shop = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [concerns, setConcerns] = useState<HealthConcern[]>([]);
  const [concernProductIds, setConcernProductIds] = useState<Set<string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedConcern, setSelectedConcern] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("featured");
  const [showFilters, setShowFilters] = useState(false);
  const [searchParams] = useSearchParams();
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();

  useEffect(() => {
    const concern = searchParams.get("concern");
    const category = searchParams.get("category");
    if (concern) setSelectedConcern(concern);
    if (category) setSelectedCategory(category);
  }, [searchParams]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [{ data: prods }, { data: cats }, { data: cons }] = await Promise.all([
        supabase.from("products").select("*"),
        supabase.from("categories").select("*").order("sort_order"),
        supabase.from("health_concerns").select("*").order("sort_order"),
      ]);
      setProducts(prods || []);
      setCategories(cats || []);
      setConcerns(cons || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  // Fetch product IDs for selected health concern
  useEffect(() => {
    if (!selectedConcern) {
      setConcernProductIds(null);
      return;
    }
    const fetchConcernProducts = async () => {
      const { data } = await supabase
        .from("product_health_concerns")
        .select("product_id")
        .eq("concern_id", selectedConcern);
      setConcernProductIds(new Set((data || []).map(d => d.product_id)));
    };
    fetchConcernProducts();
  }, [selectedConcern]);

  let filtered = [...products];
  if (selectedCategory) filtered = filtered.filter(p => p.category_id === selectedCategory);
  if (selectedConcern && concernProductIds) filtered = filtered.filter(p => concernProductIds.has(p.id));
  if (sortBy === "price-low") filtered.sort((a, b) => a.price - b.price);
  else if (sortBy === "price-high") filtered.sort((a, b) => b.price - a.price);
  else if (sortBy === "rating") filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <div className="bg-primary py-12 text-center">
          <h1 className="text-3xl md:text-4xl font-heading font-bold text-primary-foreground">Shop Superfoods</h1>
          <p className="text-primary-foreground/70 mt-2">Discover plant-powered nutrition for every wellness goal</p>
        </div>

        <div className="container py-8">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => setShowFilters(!showFilters)} className="md:hidden flex items-center gap-2 text-sm font-medium text-foreground border border-border rounded-lg px-4 py-2">
              <Filter size={16} /> Filters
            </button>
            <p className="text-sm text-muted-foreground hidden md:block">{filtered.length} products</p>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground">
              <option value="featured">Featured</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="rating">Top Rated</option>
            </select>
          </div>

          <div className="flex gap-8">
            <aside className={`${showFilters ? "block" : "hidden"} md:block w-full md:w-60 shrink-0`}>
              <div className="sticky top-24 space-y-6">
                <div className="flex items-center justify-between md:hidden">
                  <h3 className="font-heading font-semibold">Filters</h3>
                  <button onClick={() => setShowFilters(false)}><X size={20} /></button>
                </div>

                <div>
                  <h4 className="font-heading font-semibold text-sm mb-3">Category</h4>
                  <div className="space-y-2">
                    <button onClick={() => setSelectedCategory(null)} className={`block text-sm w-full text-left px-3 py-1.5 rounded-md transition-colors ${!selectedCategory ? "bg-secondary text-secondary-foreground" : "text-foreground hover:bg-muted"}`}>
                      All Categories
                    </button>
                    {categories.map(cat => (
                      <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`block text-sm w-full text-left px-3 py-1.5 rounded-md transition-colors ${selectedCategory === cat.id ? "bg-secondary text-secondary-foreground" : "text-foreground hover:bg-muted"}`}>
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-heading font-semibold text-sm mb-3">Health Concern</h4>
                  <div className="space-y-2">
                    <button onClick={() => setSelectedConcern(null)} className={`block text-sm w-full text-left px-3 py-1.5 rounded-md transition-colors ${!selectedConcern ? "bg-secondary text-secondary-foreground" : "text-foreground hover:bg-muted"}`}>
                      All Concerns
                    </button>
                    {concerns.map(c => (
                      <button key={c.id} onClick={() => setSelectedConcern(c.id)} className={`block text-sm w-full text-left px-3 py-1.5 rounded-md transition-colors ${selectedConcern === c.id ? "bg-secondary text-secondary-foreground" : "text-foreground hover:bg-muted"}`}>
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </aside>

            <div className="flex-1">
              {loading ? (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="bg-muted rounded-xl h-80 animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {filtered.map((product, i) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="group bg-background rounded-xl border border-border overflow-hidden hover:shadow-xl transition-all duration-300"
                    >
                      <Link to={`/product/${product.slug}`}>
                        <div className="relative aspect-square bg-cream-dark overflow-hidden">
                          <img src={product.image_url || "/placeholder.svg"} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          {product.badge && (
                            <span className="absolute top-3 left-3 bg-secondary text-secondary-foreground text-xs font-bold px-2.5 py-1 rounded-full">{product.badge}</span>
                          )}
                          <button
                            onClick={(e) => { e.preventDefault(); toggleWishlist(product.id); }}
                            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors"
                            aria-label="Toggle wishlist"
                          >
                            <Heart size={16} className={isInWishlist(product.id) ? "fill-destructive text-destructive" : "text-foreground"} />
                          </button>
                        </div>
                      </Link>
                      <div className="p-4">
                        <Link to={`/product/${product.slug}`}>
                          <h3 className="font-heading font-semibold text-foreground text-sm md:text-base hover:text-secondary transition-colors">{product.name}</h3>
                        </Link>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{product.short_description}</p>
                        <div className="flex items-center gap-1 mt-2">
                          <Star size={14} className="fill-gold text-gold" />
                          <span className="text-sm font-medium text-foreground">{product.rating}</span>
                          <span className="text-xs text-muted-foreground">({product.review_count})</span>
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-foreground">₹{product.price}</span>
                            {product.original_price && <span className="text-sm text-muted-foreground line-through">₹{product.original_price}</span>}
                          </div>
                          <button onClick={() => addToCart(product.id)} className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-forest-light transition-colors" aria-label="Add to cart">
                            <ShoppingBag size={16} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
              {!loading && filtered.length === 0 && (
                <div className="text-center py-16">
                  <p className="text-muted-foreground">No products found matching your filters.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Shop;
