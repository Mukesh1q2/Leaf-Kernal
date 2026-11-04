import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface StoreSettings {
  store_name: string;
  store_tagline: string;
  contact_email: string;
  support_phone: string;
  whatsapp_number: string;
  business_address: string;
  fssai_number: string;
  gstin: string;
  instagram_url: string;
  facebook_url: string;
  youtube_url: string;
  twitter_url: string;
  free_shipping_threshold: number;
  cod_enabled: boolean;
  cod_fee: number;
  seo_title_template: string;
  seo_default_description: string;
  hero_headline: string;
  hero_subtitle: string;
  hero_cta_text: string;
  hero_cta_link: string;
  quality_statement: string;
  stat_plant_based: string;
  stat_heritage: string;
  stat_quality: string;
  stat_delivery: string;
}

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  store_name: "Leaf & Kernel",
  store_tagline: "Plant-Powered Superfoods & Ayurvedic Wellness",
  contact_email: "customercare@leafandkernel.com",
  support_phone: "+91 8796745590",
  whatsapp_number: "918796745590",
  business_address: "Shop No. 4, Ground Floor, F-8/25, Sector 15, Rohini, New Delhi – 110089, India",
  fssai_number: "13326998000385",
  gstin: "07AANFL1400G1ZO",
  instagram_url: "https://instagram.com/leafandkernel",
  facebook_url: "https://facebook.com/leafandkernel",
  youtube_url: "https://youtube.com/@leafandkernel",
  twitter_url: "https://twitter.com/leafandkernel",
  free_shipping_threshold: 999,
  cod_enabled: true,
  cod_fee: 49,
  seo_title_template: "{page} | Leaf & Kernel",
  seo_default_description: "Shop pure, plant-powered Ayurvedic superfoods, Ashwagandha capsules, Moringa, Wheatgrass & Jumbo Makhana. Free shipping on orders above ₹999.",
  hero_headline: "Plant-powered superfoods for modern life",
  hero_subtitle: "Rooted in ancient Ayurvedic wisdom, crafted with care for your everyday wellness journey.",
  hero_cta_text: "Shop Superfoods",
  hero_cta_link: "/shop",
  quality_statement: "Pure green goodness and authentic Ayurvedic superfoods, crafted with complete integrity for your everyday wellness.",
  stat_plant_based: "100%",
  stat_heritage: "Pure",
  stat_quality: "Lab-Tested",
  stat_delivery: "Pan-India",
};

export function resolveStoreSettings(map: Record<string, string>): StoreSettings {
  return {
    store_name: map.store_name || DEFAULT_STORE_SETTINGS.store_name,
    store_tagline: map.store_tagline || DEFAULT_STORE_SETTINGS.store_tagline,
    contact_email: map.contact_email || DEFAULT_STORE_SETTINGS.contact_email,
    support_phone: map.support_phone || DEFAULT_STORE_SETTINGS.support_phone,
    whatsapp_number: map.whatsapp_number ? map.whatsapp_number.replace(/\D/g, "") : DEFAULT_STORE_SETTINGS.whatsapp_number,
    business_address: map.business_address || DEFAULT_STORE_SETTINGS.business_address,
    fssai_number: map.fssai_number || DEFAULT_STORE_SETTINGS.fssai_number,
    gstin: map.gstin || DEFAULT_STORE_SETTINGS.gstin,
    instagram_url: map.instagram_url || DEFAULT_STORE_SETTINGS.instagram_url,
    facebook_url: map.facebook_url || DEFAULT_STORE_SETTINGS.facebook_url,
    youtube_url: map.youtube_url || DEFAULT_STORE_SETTINGS.youtube_url,
    twitter_url: map.twitter_url || map.x_url || DEFAULT_STORE_SETTINGS.twitter_url,
    free_shipping_threshold: map.free_shipping_threshold ? Number(map.free_shipping_threshold) : DEFAULT_STORE_SETTINGS.free_shipping_threshold,
    cod_enabled: map.cod_enabled !== undefined ? map.cod_enabled === "true" : DEFAULT_STORE_SETTINGS.cod_enabled,
    cod_fee: map.cod_fee ? Number(map.cod_fee) : DEFAULT_STORE_SETTINGS.cod_fee,
    seo_title_template: map.seo_title_template || DEFAULT_STORE_SETTINGS.seo_title_template,
    seo_default_description: map.seo_default_description || DEFAULT_STORE_SETTINGS.seo_default_description,
    hero_headline: map.hero_headline || DEFAULT_STORE_SETTINGS.hero_headline,
    hero_subtitle: map.hero_subtitle || DEFAULT_STORE_SETTINGS.hero_subtitle,
    hero_cta_text: map.hero_cta_text || DEFAULT_STORE_SETTINGS.hero_cta_text,
    hero_cta_link: map.hero_cta_link || DEFAULT_STORE_SETTINGS.hero_cta_link,
    quality_statement: map.quality_statement || DEFAULT_STORE_SETTINGS.quality_statement,
    stat_plant_based: map.stat_plant_based || DEFAULT_STORE_SETTINGS.stat_plant_based,
    stat_heritage: map.stat_heritage || DEFAULT_STORE_SETTINGS.stat_heritage,
    stat_quality: map.stat_quality || DEFAULT_STORE_SETTINGS.stat_quality,
    stat_delivery: map.stat_delivery || DEFAULT_STORE_SETTINGS.stat_delivery,
  };
}

let cachedSettings: StoreSettings | null = null;
let pendingPromise: Promise<StoreSettings> | null = null;

export async function fetchStoreSettings(): Promise<StoreSettings> {
  if (cachedSettings) return cachedSettings;
  if (pendingPromise) return pendingPromise;

  pendingPromise = (async () => {
    try {
      const { data, error } = await supabase.from("site_settings").select("key, value");
      if (error) {
        console.warn("Could not load site_settings from Supabase, using defaults:", error.message);
        return DEFAULT_STORE_SETTINGS;
      }

      const map: Record<string, string> = {};
      (data || []).forEach((row) => {
        if (row.key && row.value !== null && row.value !== undefined) {
          map[row.key] = row.value;
        }
      });

      const merged = resolveStoreSettings(map);
      cachedSettings = merged;
      return merged;
    } catch (e) {
      console.warn("Exception fetching site_settings:", e);
      return DEFAULT_STORE_SETTINGS;
    } finally {
      pendingPromise = null;
    }
  })();

  return pendingPromise;
}

export function clearStoreSettingsCache() {
  cachedSettings = null;
  pendingPromise = null;
}

export function useStoreSettings() {
  const [settings, setSettings] = useState<StoreSettings>(cachedSettings || DEFAULT_STORE_SETTINGS);
  const [loading, setLoading] = useState(!cachedSettings);

  useEffect(() => {
    let mounted = true;
    fetchStoreSettings().then((s) => {
      if (mounted) {
        setSettings(s);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  return { settings, loading };
}
