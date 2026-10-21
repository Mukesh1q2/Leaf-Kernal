import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";
import { trackActivity } from "@/lib/activity";

interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    price: number;
    original_price: number | null;
    image_url: string | null;
    slug: string;
  };
}

interface CartContextType {
  items: CartItem[];
  loading: boolean;
  itemCount: number;
  subtotal: number;
  addToCart: (productId: string, quantity?: number) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
}

const GUEST_CART_KEY = "leaf_kernel_guest_cart";

interface GuestCartItem {
  product_id: string;
  quantity: number;
}

const getGuestCart = (): GuestCartItem[] => {
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveGuestCart = (cart: GuestCartItem[]) => {
  try {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart));
  } catch {}
};

const CartContext = createContext<CartContextType>({
  items: [],
  loading: false,
  itemCount: 0,
  subtotal: 0,
  addToCart: async () => {},
  removeFromCart: async () => {},
  updateQuantity: async () => {},
  clearCart: async () => {},
  refreshCart: async () => {},
});

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchGuestCart = useCallback(async () => {
    const local = getGuestCart();
    if (local.length === 0) {
      setItems([]);
      return;
    }
    setLoading(true);
    const productIds = local.map((i) => i.product_id);
    const { data: products } = await supabase
      .from("products")
      .select("id, name, price, original_price, image_url, slug")
      .in("id", productIds);

    const prodMap = new Map((products || []).map((p) => [p.id, p]));
    const cartItems: CartItem[] = local
      .filter((i) => prodMap.has(i.product_id))
      .map((i) => ({
        id: `guest-${i.product_id}`,
        product_id: i.product_id,
        quantity: i.quantity,
        product: prodMap.get(i.product_id)!,
      }));
    setItems(cartItems);
    setLoading(false);
  }, []);

  const syncGuestCartToUser = useCallback(async (userId: string) => {
    const local = getGuestCart();
    if (local.length === 0) return;
    for (const item of local) {
      const { data: existing } = await supabase
        .from("cart_items")
        .select("id, quantity")
        .eq("user_id", userId)
        .eq("product_id", item.product_id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("cart_items")
          .update({ quantity: existing.quantity + item.quantity })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("cart_items")
          .insert({ user_id: userId, product_id: item.product_id, quantity: item.quantity });
      }
    }
    localStorage.removeItem(GUEST_CART_KEY);
  }, []);

  const fetchCart = useCallback(async () => {
    if (!user) {
      await fetchGuestCart();
      return;
    }
    setLoading(true);
    await syncGuestCartToUser(user.id);
    const { data } = await supabase
      .from("cart_items")
      .select("id, product_id, quantity, products:product_id(id, name, price, original_price, image_url, slug)")
      .eq("user_id", user.id);

    if (data) {
      setItems(data.map((item: any) => ({ ...item, product: item.products })).filter((item: any) => item.product));
    }
    setLoading(false);
  }, [user, fetchGuestCart, syncGuestCartToUser]);

  useEffect(() => { fetchCart(); }, [fetchCart]);

  const addToCart = async (productId: string, quantity = 1) => {
    if (!user) {
      const local = getGuestCart();
      const existing = local.find((i) => i.product_id === productId);
      if (existing) {
        existing.quantity += quantity;
      } else {
        local.push({ product_id: productId, quantity });
      }
      saveGuestCart(local);
      toast.success("Added to cart!");
      await fetchGuestCart();
      trackActivity("add_to_cart", productId, { quantity, guest: true });
      return;
    }
    const product = items.find((i) => i.product_id === productId)?.product;
    const existing = items.find((i) => i.product_id === productId);
    if (existing) {
      await supabase.from("cart_items").update({ quantity: existing.quantity + quantity }).eq("id", existing.id);
    } else {
      await supabase.from("cart_items").insert({ user_id: user.id, product_id: productId, quantity });
    }
    trackEvent("add_to_cart", { currency: "INR", value: (product?.price || 0) * quantity, item_id: productId, quantity });
    trackActivity("add_to_cart", productId, { quantity });
    toast.success("Added to cart!");
    await fetchCart();
  };

  const removeFromCart = async (productId: string) => {
    if (!user) {
      const local = getGuestCart().filter((i) => i.product_id !== productId);
      saveGuestCart(local);
      await fetchGuestCart();
      return;
    }
    await supabase.from("cart_items").delete().eq("user_id", user.id).eq("product_id", productId);
    await fetchCart();
  };

  const updateQuantity = async (productId: string, quantity: number) => {
    if (quantity <= 0) {
      await removeFromCart(productId);
      return;
    }
    if (!user) {
      const local = getGuestCart();
      const existing = local.find((i) => i.product_id === productId);
      if (existing) {
        existing.quantity = quantity;
        saveGuestCart(local);
      }
      await fetchGuestCart();
      return;
    }
    await supabase.from("cart_items").update({ quantity }).eq("user_id", user.id).eq("product_id", productId);
    await fetchCart();
  };

  const clearCart = async () => {
    if (!user) {
      localStorage.removeItem(GUEST_CART_KEY);
      setItems([]);
      return;
    }
    await supabase.from("cart_items").delete().eq("user_id", user.id);
    setItems([]);
  };

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + (i.product?.price ?? 0) * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, loading, itemCount, subtotal, addToCart, removeFromCart, updateQuantity, clearCart, refreshCart: fetchCart }}>
      {children}
    </CartContext.Provider>
  );
};
