import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useWishlist } from "@/contexts/WishlistContext";
import { useCart } from "@/contexts/CartContext";
import { SEOHead } from "@/components/SEOHead";
import { Heart, ShoppingBag, Trash2, Star, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import ProductImage from "@/components/ProductImage";

const Wishlist = () => {
  const { wishlistProducts, loading, removeFromWishlist } = useWishlist();
  const { addToCart } = useCart();

  const handleMoveToCart = async (productId: string) => {
    await addToCart(productId, 1);
    await removeFromWishlist(productId);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead
        title="My Wishlist"
        description="View and manage your saved plant-powered superfoods and Ayurvedic wellness products."
        url="https://leafandkernel.com/wishlist"
      />
      <Header />

      <main className="container py-8 md:py-16 flex-1">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-heading font-bold text-foreground">My Wishlist</h1>
            <p className="text-muted-foreground mt-1">
              {wishlistProducts.length} {wishlistProducts.length === 1 ? "item" : "items"} saved
            </p>
          </div>
          {wishlistProducts.length > 0 && (
            <Link to="/shop">
              <Button variant="outline" className="gap-2">
                Continue Shopping <ArrowRight size={16} />
              </Button>
            </Link>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-secondary" />
          </div>
        ) : wishlistProducts.length === 0 ? (
          <div className="text-center py-20 bg-muted/20 border border-border rounded-2xl max-w-lg mx-auto p-8">
            <Heart className="h-16 w-16 text-muted-foreground/40 mx-auto mb-4" />
            <h2 className="text-2xl font-heading font-semibold text-foreground mb-2">Your wishlist is empty</h2>
            <p className="text-muted-foreground mb-6 text-sm">
              Save your favorite superfoods and Ayurvedic supplements here to easily order them later.
            </p>
            <Link to="/shop">
              <Button className="gap-2">
                <ShoppingBag size={18} /> Explore Products
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {wishlistProducts.map((product) => {
              const discount = product.original_price
                ? Math.round((1 - product.price / product.original_price) * 100)
                : 0;

              return (
                <div
                  key={product.id}
                  className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-all flex flex-col group"
                >
                  <div className="relative aspect-square bg-muted/50 overflow-hidden">
                    <Link to={`/product/${product.slug}`}>
                      <ProductImage
                        src={product.image_url}
                        slug={product.slug}
                        name={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </Link>
                    {product.badge && (
                      <span className="absolute top-3 left-3 bg-secondary text-secondary-foreground text-xs font-bold px-2.5 py-1 rounded-full">
                        {product.badge}
                      </span>
                    )}
                    <button
                      onClick={() => removeFromWishlist(product.id)}
                      className="absolute top-3 right-3 p-2 rounded-full bg-background/80 hover:bg-destructive hover:text-destructive-foreground text-muted-foreground transition-colors shadow-sm"
                      aria-label="Remove from wishlist"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      {product.rating > 0 && (
                        <div className="flex items-center gap-1 mb-1.5 text-xs text-muted-foreground">
                          <Star size={14} className="fill-gold text-gold" />
                          <span className="font-semibold text-foreground">{product.rating}</span>
                          <span>({product.review_count || 0})</span>
                        </div>
                      )}
                      <Link to={`/product/${product.slug}`}>
                        <h3 className="font-heading font-semibold text-foreground hover:text-secondary transition-colors line-clamp-2">
                          {product.name}
                        </h3>
                      </Link>
                    </div>

                    <div className="mt-4 pt-3 border-t border-border/60">
                      <div className="flex items-baseline gap-2 mb-3">
                        <span className="text-xl font-bold text-foreground">₹{product.price}</span>
                        {product.original_price && (
                          <>
                            <span className="text-sm text-muted-foreground line-through">₹{product.original_price}</span>
                            <span className="text-xs font-semibold text-secondary bg-secondary/10 px-1.5 py-0.5 rounded">
                              {discount}% OFF
                            </span>
                          </>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleMoveToCart(product.id)}
                          className="w-full gap-2 text-sm"
                          size="sm"
                        >
                          <ShoppingBag size={16} /> Move to Cart
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default Wishlist;
