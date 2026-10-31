import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Star, ShoppingBag, Filter, X, Heart } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import ProductImage from "@/components/ProductImage";
import ProductCouponBadge from "@/components/ProductCouponBadge";
import { fetchStorefrontPromotions, isOfferEligibleForProduct, type StorefrontCoupon } from "@/lib/couponPromotions";

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
  stock_quantity?: number | null;
  created_at?: string;
}

interface Category { id: string; name: string; slug: string; parent_id?: string | null; }
interface HealthConcern { id: string; name: string; slug: string; }

const Shop = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [concerns, setConcerns] = useState<HealthConcern[]>([]);
  const [promotions, setPromotions] = useState<StorefrontCoupon[]>([]);
  const [concernProductIds, setConcernProductIds] = useState<Set<string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedConcern, setSelectedConcern] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("featured");
  const [showFilters, setShowFilters] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 5000]);
  const [minRating, setMinRating] = useState(0);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [searchParams] = useSearchParams();
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();

  useEffect(() => {
    const concern = searchParams.get("concern");
    const category = searchParams.get("category");
    if (concern) setSelectedConcern(concern);
    if (category) setSelectedCategory(category);
  }, [searchParams]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const [{ data: prods, error: pErr }, { data: cats, error: cErr }, { data: cons, error: hErr }, activePromos] = await Promise.all([
        supabase.from("products").select("*").eq("is_active", true),
        supabase.from("categories").select("*").order("sort_order"),
        supabase.from("health_concerns").select("*").order("sort_order"),
        fetchStorefrontPromotions(),
      ]);
      if (pErr) console.error("Error fetching products:", pErr);
      if (cErr) console.error("Error fetching categories:", cErr);
      if (hErr) console.error("Error fetching health concerns:", hErr);
      if (pErr && !prods) {
        setFetchError("Unable to load product catalog. Please try again later.");
      }
      setProducts(prods || []);
      setCategories(cats || []);
      setConcerns(cons || []);
      setPromotions(activePromos || []);
    } catch (err: any) {
      console.error("Error loading shop data:", err);
      setFetchError("Unable to load product catalog. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch product IDs for selected health concern
  useEffect(() => {
    if (!selectedConcern) {
      setConcernProductIds(null);
      return;
    }
    const matched = concerns.find(c => c.id === selectedConcern || c.slug === selectedConcern);
    const targetConcernId = matched ? matched.id : selectedConcern;
    const fetchConcernProducts = async () => {
      const { data } = await supabase
        .from("product_health_concerns")
        .select("product_id")
        .eq("concern_id", targetConcernId);
      setConcernProductIds(new Set((data || []).map(d => d.product_id)));
    };
    fetchConcernProducts();
  }, [selectedConcern, concerns]);

  // Build child-category map for hierarchy match
  const childMap = new Map<string, string[]>();
  categories.forEach(c => {
    if (c.parent_id) {
      const arr = childMap.get(c.parent_id) || [];
      arr.push(c.id);
      childMap.set(c.parent_id, arr);
    }
  });

  let filtered = [...products];
  if (selectedCategory) {
    const matchedCat = categories.find(c => c.id === selectedCategory || c.slug === selectedCategory);
    const targetCatId = matchedCat ? matchedCat.id : selectedCategory;
    const ids = new Set([targetCatId, ...(childMap.get(targetCatId) || [])]);
    filtered = filtered.filter(p => p.category_id && ids.has(p.category_id));
  }
  if (selectedConcern && concernProductIds) filtered = filtered.filter(p => concernProductIds.has(p.id));
  filtered = filtered.filter(p => p.price >= priceRange[0] && p.price <= priceRange[1]);
  if (minRating > 0) filtered = filtered.filter(p => (p.rating || 0) >= minRating);
  if (inStockOnly) filtered = filtered.filter(p => (p.stock_quantity ?? 0) > 0);
  if (sortBy === "price-low") filtered.sort((a, b) => a.price - b.price);
  else if (sortBy === "price-high") filtered.sort((a, b) => b.price - a.price);
  else if (sortBy === "rating") filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  else if (sortBy === "newest") filtered.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  else if (sortBy === "popularity") filtered.sort((a, b) => (b.review_count || 0) - (a.review_count || 0));

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Shop Plant-Powered Ayurvedic Superfoods"
        description="Discover pure plant-powered nutrition, Ayurvedic superfoods, adaptogens, and wellness powders."
      />
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
              <option value="popularity">Most Popular</option>
              <option value="newest">New Arrivals</option>
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
                      <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`block text-sm w-full text-left px-3 py-1.5 rounded-md transition-colors ${selectedCategory === cat.id || selectedCategory === cat.slug ? "bg-secondary text-secondary-foreground" : "text-foreground hover:bg-muted"}`}>
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
                      <button key={c.id} onClick={() => setSelectedConcern(c.id)} className={`block text-sm w-full text-left px-3 py-1.5 rounded-md transition-colors ${selectedConcern === c.id || selectedConcern === c.slug ? "bg-secondary text-secondary-foreground" : "text-foreground hover:bg-muted"}`}>
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-heading font-semibold text-sm mb-3">Price Range</h4>
                  <div className="flex gap-2 items-center">
                    <input type="number" value={priceRange[0]} onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])} className="w-20 text-sm border border-border rounded px-2 py-1 bg-background" placeholder="Min" />
                    <span className="text-muted-foreground">–</span>
                    <input type="number" value={priceRange[1]} onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])} className="w-20 text-sm border border-border rounded px-2 py-1 bg-background" placeholder="Max" />
                  </div>
                </div>

                <div>
                  <h4 className="font-heading font-semibold text-sm mb-3">Min Rating</h4>
                  <div className="flex gap-1">
                    {[0, 3, 4, 4.5].map(r => (
                      <button key={r} onClick={() => setMinRating(r)} className={`text-xs px-2 py-1 rounded-md ${minRating === r ? "bg-secondary text-secondary-foreground" : "bg-muted text-foreground hover:bg-muted/70"}`}>
                        {r === 0 ? "Any" : `${r}★+`}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} className="accent-primary" />
                  In stock only
                </label>
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
                          <ProductImage
                            src={product.image_url}
                            slug={product.slug}
                            name={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
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
                        {product.review_count && product.review_count > 0 ? (
                          <div className="flex items-center gap-1 mt-2">
                            <Star size={14} className="fill-gold text-gold" />
                            <span className="text-sm font-medium text-foreground">{product.rating}</span>
                            <span className="text-xs text-muted-foreground">({product.review_count})</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 mt-2">
                            <span className="text-[11px] font-semibold text-secondary bg-secondary/10 px-2 py-0.5 rounded-full">
                              ✨ New Launch
                            </span>
                          </div>
                        )}
                        {(() => {
                          const applicableOffer = promotions.find((o) =>
                            isOfferEligibleForProduct(o, product.id, product.category_id)
                          );
                          return applicableOffer ? (
                            <div className="mt-2">
                              <ProductCouponBadge compact offer={applicableOffer} />
                            </div>
                          ) : null;
                        })()}
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
              {!loading && fetchError && (
                <div className="text-center py-16">
                  <p className="text-muted-foreground mb-4">{fetchError}</p>
                  <button onClick={fetchData} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-forest-light transition-colors">
                    Retry
                  </button>
                </div>
              )}
              {!loading && !fetchError && filtered.length === 0 && (
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
