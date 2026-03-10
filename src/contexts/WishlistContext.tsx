import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { toast } from "sonner";

interface WishlistContextType {
  wishlistIds: Set<string>;
  loading: boolean;
  isInWishlist: (productId: string) => boolean;
  toggleWishlist: (productId: string) => Promise<void>;
  wishlistProducts: any[];
  refreshWishlist: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextType>({
  wishlistIds: new Set(),
  loading: false,
  isInWishlist: () => false,
  toggleWishlist: async () => {},
  wishlistProducts: [],
  refreshWishlist: async () => {},
});

export const useWishlist = () => useContext(WishlistContext);

export const WishlistProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [wishlistProducts, setWishlistProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchWishlist = useCallback(async () => {
    if (!user) {
      setWishlistIds(new Set());
      setWishlistProducts([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("wishlist_items")
      .select("product_id, products:product_id(id, name, price, original_price, image_url, slug)")
      .eq("user_id", user.id);
    if (data) {
      setWishlistIds(new Set(data.map((d: any) => d.product_id)));
      setWishlistProducts(data.map((d: any) => d.products).filter(Boolean));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchWishlist(); }, [fetchWishlist]);

  const isInWishlist = (productId: string) => wishlistIds.has(productId);

  const toggleWishlist = async (productId: string) => {
    if (!user) {
      toast.error("Please login to use wishlist");
      return;
    }
    if (wishlistIds.has(productId)) {
      await supabase.from("wishlist_items").delete().eq("user_id", user.id).eq("product_id", productId);
      toast.success("Removed from wishlist");
    } else {
      await supabase.from("wishlist_items").insert({ user_id: user.id, product_id: productId });
      toast.success("Added to wishlist!");
    }
    await fetchWishlist();
  };

  return (
    <WishlistContext.Provider value={{ wishlistIds, loading, isInWishlist, toggleWishlist, wishlistProducts, refreshWishlist: fetchWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
};
