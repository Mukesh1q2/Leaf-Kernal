import { motion } from "framer-motion";
import { Star, ShoppingBag } from "lucide-react";
import productMoringa from "@/assets/product-moringa.jpg";
import productTurmeric from "@/assets/product-turmeric.jpg";
import productAshwagandha from "@/assets/product-ashwagandha.jpg";
import productSpirulina from "@/assets/product-spirulina.jpg";

const products = [
  {
    name: "Moringa Leaf Powder",
    tag: "Immunity",
    price: 599,
    originalPrice: 749,
    rating: 4.8,
    reviews: 234,
    badge: "Best Seller",
    image: productMoringa,
  },
  {
    name: "Golden Turmeric Capsules",
    tag: "Joint Care",
    price: 799,
    originalPrice: 999,
    rating: 4.7,
    reviews: 189,
    badge: "20% OFF",
    image: productTurmeric,
  },
  {
    name: "Ashwagandha Root Powder",
    tag: "Stress Relief",
    price: 649,
    originalPrice: 849,
    rating: 4.9,
    reviews: 312,
    badge: "Top Rated",
    image: productAshwagandha,
  },
  {
    name: "Spirulina Superfood Blend",
    tag: "Energy",
    price: 899,
    originalPrice: 1099,
    rating: 4.6,
    reviews: 156,
    badge: "New",
    image: productSpirulina,
  },
];

const BestSellers = () => {
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
              key={product.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group bg-background rounded-xl border border-border overflow-hidden hover:shadow-xl transition-all duration-300"
            >
              <div className="relative aspect-square bg-cream-dark overflow-hidden">
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <span className="absolute top-3 left-3 bg-secondary text-secondary-foreground text-xs font-bold px-2.5 py-1 rounded-full">
                  {product.badge}
                </span>
              </div>

              <div className="p-4">
                <span className="text-xs text-secondary font-medium uppercase tracking-wide">{product.tag}</span>
                <h3 className="font-heading font-semibold text-foreground mt-1 text-sm md:text-base">
                  {product.name}
                </h3>

                <div className="flex items-center gap-1 mt-2">
                  <Star size={14} className="fill-gold text-gold" />
                  <span className="text-sm font-medium text-foreground">{product.rating}</span>
                  <span className="text-xs text-muted-foreground">({product.reviews})</span>
                </div>

                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-foreground">₹{product.price}</span>
                    <span className="text-sm text-muted-foreground line-through">₹{product.originalPrice}</span>
                  </div>
                  <button
                    className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-forest-light transition-colors"
                    aria-label={`Add ${product.name} to cart`}
                  >
                    <ShoppingBag size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BestSellers;
