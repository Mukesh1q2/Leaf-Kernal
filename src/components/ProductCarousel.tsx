import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Star, ShoppingBag } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import ProductImage from "@/components/ProductImage";
import ProductCouponBadge from "@/components/ProductCouponBadge";
import { fetchStorefrontPromotions, isOfferEligibleForProduct, type StorefrontCoupon } from "@/lib/couponPromotions";

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  original_price: number | null;
  image_url: string | null;
  badge: string | null;
  rating: number | null;
  review_count: number | null;
  category_id?: string | null;
}

interface Props {
  title: string;
  subtitle?: string;
  products: Product[];
  loading?: boolean;
  emptyText?: string;
}

const ProductCarousel = ({ title, subtitle, products, loading, emptyText }: Props) => {
  const { addToCart } = useCart();
  const [promotions, setPromotions] = useState<StorefrontCoupon[]>([]);

  useEffect(() => {
    let mounted = true;
    fetchStorefrontPromotions().then((offers) => {
      if (mounted) setPromotions(offers);
    });
    return () => {
      mounted = false;
    };
  }, []);
  if (!loading && products.length === 0 && !emptyText) return null;

  return (
    <section className="container py-10">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-heading font-bold text-foreground">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
      </div>
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="bg-muted rounded-xl h-72 animate-pulse" />)}
        </div>
      ) : products.length === 0 ? (
        <p className="text-muted-foreground text-sm">{emptyText}</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {products.map(product => (
            <div key={product.id} className="group bg-background rounded-xl border border-border overflow-hidden hover:shadow-xl transition-all">
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
                </div>
              </Link>
              <div className="p-4">
                <Link to={`/product/${product.slug}`}>
                  <h3 className="font-heading font-semibold text-sm text-foreground hover:text-secondary transition-colors line-clamp-1">{product.name}</h3>
                </Link>
                <div className="flex items-center gap-1 mt-2">
                  <Star size={14} className="fill-gold text-gold" />
                  <span className="text-sm font-medium text-foreground">{product.rating}</span>
                  <span className="text-xs text-muted-foreground">({product.review_count})</span>
                </div>
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
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default ProductCarousel;
