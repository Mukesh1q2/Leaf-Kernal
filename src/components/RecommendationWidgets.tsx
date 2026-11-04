import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ProductCarousel from "./ProductCarousel";

export const TrendingProducts = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.rpc("get_trending_products" as any, { p_limit: 8 });
        if (!error && data && data.length > 0) {
          setProducts(data);
        } else {
          // Fallback to top-rated active products from catalog
          const { data: fallbackData } = await supabase
            .from("products")
            .select("*")
            .eq("is_active", true)
            .order("rating", { ascending: false })
            .limit(8);
          setProducts(fallbackData || []);
        }
      } catch {
        const { data: fallbackData } = await supabase
          .from("products")
          .select("*")
          .eq("is_active", true)
          .order("rating", { ascending: false })
          .limit(8);
        setProducts(fallbackData || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  if (!loading && products.length === 0) return null;
  return <ProductCarousel title="🔥 Trending Now" subtitle="What our community is loving this week" products={products} loading={loading} />;
};

export const RecommendedForYou = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      try {
        const { data, error } = await supabase.rpc("get_recommended_products" as any, { p_user_id: user.id, p_limit: 8 });
        if (!error && data && data.length > 0) {
          setProducts(data);
        } else {
          // Fallback to active catalog products
          const { data: fallbackData } = await supabase
            .from("products")
            .select("*")
            .eq("is_active", true)
            .limit(8);
          setProducts(fallbackData || []);
        }
      } catch {
        const { data: fallbackData } = await supabase
          .from("products")
          .select("*")
          .eq("is_active", true)
          .limit(8);
        setProducts(fallbackData || []);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);
  if (!user || (!loading && products.length === 0)) return null;
  return <ProductCarousel title="✨ Recommended for You" subtitle="Curated based on your wellness journey" products={products} loading={loading} />;
};

export const FrequentlyBoughtTogether = ({ productId }: { productId: string }) => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.rpc("get_frequently_bought_together" as any, { p_product_id: productId, p_limit: 4 });
        if (!error && data && data.length > 0) {
          setProducts(data);
        } else {
          // Fallback to complementary active products excluding current product
          const { data: fallbackData } = await supabase
            .from("products")
            .select("*")
            .eq("is_active", true)
            .neq("id", productId)
            .limit(4);
          setProducts(fallbackData || []);
        }
      } catch {
        const { data: fallbackData } = await supabase
          .from("products")
          .select("*")
          .eq("is_active", true)
          .neq("id", productId)
          .limit(4);
        setProducts(fallbackData || []);
      } finally {
        setLoading(false);
      }
    })();
  }, [productId]);
  if (!loading && products.length === 0) return null;
  return <ProductCarousel title="Frequently Bought Together" products={products} loading={loading} />;
};
