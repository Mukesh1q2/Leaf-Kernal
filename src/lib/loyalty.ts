import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type LoyaltySettings = {
  signupBonus: number;
  earnPerRupees: number;
  redeemRate: number;     // points per ₹1
  reviewBonus: number;
  maxRedeemPct: number;
  silverMin: number;
  goldMin: number;
  silverMult: number;
  goldMult: number;
};

const DEFAULTS: LoyaltySettings = {
  signupBonus: 50, earnPerRupees: 10, redeemRate: 10, reviewBonus: 50,
  maxRedeemPct: 50, silverMin: 500, goldMin: 2000, silverMult: 1.25, goldMult: 1.5,
};

const KEY_MAP: Record<keyof LoyaltySettings, string> = {
  signupBonus: "loyalty_signup_bonus",
  earnPerRupees: "loyalty_earn_per_rupees",
  redeemRate: "loyalty_redeem_rate",
  reviewBonus: "loyalty_review_bonus",
  maxRedeemPct: "loyalty_max_redeem_pct",
  silverMin: "loyalty_tier_silver_min",
  goldMin: "loyalty_tier_gold_min",
  silverMult: "loyalty_tier_silver_mult",
  goldMult: "loyalty_tier_gold_mult",
};

export const useLoyaltySettings = () => {
  const [settings, setSettings] = useState<LoyaltySettings>(DEFAULTS);
  useEffect(() => {
    (async () => {
      const keys = Object.values(KEY_MAP);
      const { data } = await supabase.from("site_settings").select("key,value").in("key", keys);
      if (!data) return;
      const map = new Map(data.map((r: any) => [r.key, r.value]));
      const next = { ...DEFAULTS };
      (Object.keys(KEY_MAP) as (keyof LoyaltySettings)[]).forEach((k) => {
        const v = map.get(KEY_MAP[k]);
        if (v != null) (next as any)[k] = Number(v);
      });
      setSettings(next);
    })();
  }, []);
  return settings;
};

export const useLoyaltyBalance = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [lifetime, setLifetime] = useState(0);
  const [tier, setTier] = useState<{ name: string; multiplier: number }>({ name: "Bronze", multiplier: 1 });

  const refresh = async () => {
    if (!user) { setBalance(0); setLifetime(0); return; }
    const [{ data: bal }, { data: t }] = await Promise.all([
      supabase.from("loyalty_balances").select("total_points,lifetime_points").eq("user_id", user.id).maybeSingle(),
      (supabase as any).rpc("get_user_tier", { p_user_id: user.id }),
    ]);
    setBalance((bal as any)?.total_points || 0);
    setLifetime((bal as any)?.lifetime_points || 0);
    if (t && t[0]) setTier({ name: t[0].tier, multiplier: Number(t[0].multiplier) });
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [user]);
  return { balance, lifetime, tier, refresh };
};

export const computeMaxRedeemable = (
  balance: number, subtotal: number, settings: LoyaltySettings
) => {
  const cap = Math.floor((subtotal * settings.maxRedeemPct / 100) * settings.redeemRate);
  return Math.max(0, Math.min(balance, cap));
};

export const pointsToRupees = (pts: number, rate: number) => Math.round((pts / Math.max(rate, 1)) * 100) / 100;

export const redeemPoints = async (points: number, orderId: string) => {
  const { data, error } = await (supabase as any).rpc("redeem_loyalty_points", { p_points: points, p_order_id: orderId });
  if (error) throw error;
  return data as { points: number; discount: number };
};