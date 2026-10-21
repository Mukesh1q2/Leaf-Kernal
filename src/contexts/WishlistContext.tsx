import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { toast } from "sonner";

interface WishlistContextType {
  wishlistIds: Set<string>;
  wishlistProducts: any[];
  loading: boolean;
  itemCount: number;
  isInWishlist: (productId: string) => boolean;
  toggleWishlist: (productId: string) => Promise<void>;
  removeFromWishlist: (productId: string) => Promise<void>;
  refreshWishlist: () => Promise<void>;
}

const GUEST_WISHLIST_KEY = "leaf_kernel_guest_wishlist";

const getGuestWishlist = (): string[] => {
  try {
    const raw = localStorage.getItem(GUEST_WISHLIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveGuestWishlist = (ids: string[]) => {
  try {
    localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(ids));
  } catch {}
};

const WishlistContext = createContext<WishlistContextType>({
  wishlistIds: new Set(),
  wishlistProducts: [],
  loading: false,
  itemCount: 0,
  isInWishlist: () => false,
  toggleWishlist: async () => {},
  removeFromWishlist: async () => {},
  refreshWishlist: async () => {},
});

export const useWishlist = () => useContext(WishlistContext);

export const WishlistProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [wishlistProducts, setWishlistProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchGuestWishlist = useCallback(async () => {
    const local = getGuestWishlist();
    setWishlistIds(new Set(local));
    if (local.length === 0) {
      setWishlistProducts([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("products")
      .select("id, name, price, original_price, image_url, slug, rating, review_count, badge, stock_quantity")
      .in("id", local);
    setWishlistProducts(data || []);
    setLoading(false);
  }, []);

  const syncGuestWishlistToUser = useCallback(async (userId: string) => {
    const local = getGuestWishlist();
    if (local.length === 0) return;
    for (const productId of local) {
      const { data: existing } = await supabase
        .from("wishlist_items")
        .select("id")
        .eq("user_id", userId)
        .eq("product_id", productId)
        .maybeSingle();

      if (!existing) {
        await supabase
          .from("wishlist_items")
          .insert({ user_id: userId, product_id: productId });
      }
    }
    localStorage.removeItem(GUEST_WISHLIST_KEY);
  }, []);

  const fetchWishlist = useCallback(async () => {
    if (!user) {
      await fetchGuestWishlist();
      return;
    }
    setLoading(true);
    await syncGuestWishlistToUser(user.id);
    const { data } = await supabase
      .from("wishlist_items")
      .select("product_id, products:product_id(id, name, price, original_price, image_url, slug, rating, review_count, badge, stock_quantity)")
      .eq("user_id", user.id);

    if (data) {
      setWishlistIds(new Set(data.map((d: any) => d.product_id)));
      setWishlistProducts(data.map((d: any) => d.products).filter(Boolean));
    }
    setLoading(false);
  }, [user, fetchGuestWishlist, syncGuestWishlistToUser]);

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  const isInWishlist = (productId: string) => wishlistIds.has(productId);

  const toggleWishlist = async (productId: string) => {
    if (!user) {
      const local = getGuestWishlist();
      const next = local.includes(productId)
        ? local.filter((id) => id !== productId)
        : [...local, productId];
      saveGuestWishlist(next);
      setWishlistIds(new Set(next));
      if (local.includes(productId)) {
        toast.success("Removed from wishlist");
      } else {
        toast.success("Added to wishlist!");
      }
      await fetchGuestWishlist();
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

  const removeFromWishlist = async (productId: string) => {
    if (!user) {
      const local = getGuestWishlist().filter((id) => id !== productId);
      saveGuestWishlist(local);
      await fetchGuestWishlist();
      return;
    }
    await supabase.from("wishlist_items").delete().eq("user_id", user.id).eq("product_id", productId);
    await fetchWishlist();
  };

  const itemCount = wishlistIds.size;

  return (
    <WishlistContext.Provider
      value={{
        wishlistIds,
        wishlistProducts,
        loading,
        itemCount,
        isInWishlist,
        toggleWishlist,
        removeFromWishlist,
        refreshWishlist: fetchWishlist,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
};
