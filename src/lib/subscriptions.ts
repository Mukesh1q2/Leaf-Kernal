import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type Subscription = {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  cadence_days: number;
  discount_pct: number;
  status: "active" | "paused" | "cancelled";
  next_charge_at: string;
  last_charge_at: string | null;
  created_at: string;
  product?: { name: string; slug: string; image_url: string | null; price: number };
};

export function useSubscriptionDiscount() {
  const [pct, setPct] = useState<number>(10);
  useEffect(() => {
    supabase.from("site_settings").select("value").eq("key", "subscription_default_discount_pct").maybeSingle()
      .then(({ data }) => { if (data?.value) setPct(Number(data.value)); });
  }, []);
  return pct;
}

export function useMySubscriptions() {
  const { user } = useAuth();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) { setSubs([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("subscriptions")
      .select("*, product:products(name,slug,image_url,price)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setSubs((data || []) as any);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);
  return { subs, loading, refresh };
}

export async function createSubscription(params: {
  userId: string;
  productId: string;
  quantity: number;
  cadenceDays: number;
  discountPct?: number; // Ignored — server validates from site_settings
}) {
  const next = new Date(Date.now() + params.cadenceDays * 24 * 60 * 60 * 1000).toISOString();

  // Fetch the server-authoritative discount from site_settings
  const { data: setting } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "subscription_default_discount_pct")
    .maybeSingle();
  const serverDiscount = setting?.value ? Number(setting.value) : 10;

  const { data, error } = await supabase.from("subscriptions").insert({
    user_id: params.userId,
    product_id: params.productId,
    quantity: params.quantity,
    cadence_days: params.cadenceDays,
    discount_pct: serverDiscount, // Server-validated, not client-supplied
    next_charge_at: next,
    status: "active",
  }).select().single();
  if (error) throw error;
  return data;
}

export async function updateSubscriptionStatus(id: string, status: "active" | "paused" | "cancelled") {
  const { error } = await supabase.from("subscriptions").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function skipNextCharge(id: string, currentNext: string, cadenceDays: number) {
  const newNext = new Date(new Date(currentNext).getTime() + cadenceDays * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from("subscriptions").update({ next_charge_at: newNext }).eq("id", id);
  if (error) throw error;
}