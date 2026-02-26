import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Star, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";

const BestSellers = () => {
  const [products, setProducts] = useState<any[]>([]);
  const { addToCart } = useCart();

  useEffect(() => {
    supabase.from("products").select("*").eq("is_featured", true).order("review_count", { ascending: false }).limit(8)
      .then(({ data }) => setProducts(data || []));
  }, []);

  return (
    <section id="bestsellers" className="py-16 md:py-24">
      <div className="container">
        <div className="text-center mb-12">
          <span className="text-secondary text-sm font-semibold uppercase tracking-widest">Customer Favorites</span>
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground mt-2">Our Best Sellers</h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {products.map((product, i) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group bg-background rounded-xl border border-border overflow-hidden hover:shadow-xl transition-all duration-300"
            >
              <Link to={`/product/${product.slug}`}>
                <div className="relative aspect-square bg-cream-dark overflow-hidden">
                  <img
                    src={product.image_url || "/placeholder.svg"}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {product.badge && (
                    <span className="absolute top-3 left-3 bg-secondary text-secondary-foreground text-xs font-bold px-2.5 py-1 rounded-full">{product.badge}</span>
                  )}
                </div>
              </Link>
              <div className="p-4">
                <Link to={`/product/${product.slug}`}>
                  <h3 className="font-heading font-semibold text-foreground mt-1 text-sm md:text-base hover:text-secondary transition-colors">{product.name}</h3>
                </Link>
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
                  <button onClick={() => addToCart(product.id)} className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-forest-light transition-colors" aria-label={`Add ${product.name} to cart`}>
                    <ShoppingBag size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="text-center mt-8">
          <Link to="/shop" className="inline-flex items-center px-8 py-3 border-2 border-primary text-primary font-semibold rounded-lg hover:bg-primary hover:text-primary-foreground transition-colors">
            View All Products
          </Link>
        </div>
      </div>
    </section>
  );
};

export default BestSellers;
