import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ProductCarousel from "./ProductCarousel";

export const TrendingProducts = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("get_trending_products", { p_limit: 8 });
      setProducts(data || []);
      setLoading(false);
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
      const { data } = await supabase.rpc("get_recommended_products", { p_user_id: user.id, p_limit: 8 });
      setProducts(data || []);
      setLoading(false);
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
      const { data } = await supabase.rpc("get_frequently_bought_together", { p_product_id: productId, p_limit: 4 });
      setProducts(data || []);
      setLoading(false);
    })();
  }, [productId]);
  if (!loading && products.length === 0) return null;
  return <ProductCarousel title="Frequently Bought Together" products={products} loading={loading} />;
};
