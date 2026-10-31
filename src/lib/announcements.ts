import { supabase } from "@/integrations/supabase/client";
import {
  fetchStorefrontPromotions,
  formatDiscountLabel,
  formatCouponTerms,
  type StorefrontCoupon,
} from "./couponPromotions";

export type AnnouncementStatus = "draft" | "published";
export type CouponLinkMode = "automatic" | "manual" | "none";

export interface AnnouncementBarConfig {
  id: string;
  name: string;
  is_enabled: boolean;
  status: AnnouncementStatus;
  priority: number;
  free_shipping_threshold: number;
  announcement_copy: string;
  coupon_link_mode: CouponLinkMode;
  selected_coupon_id?: string | null;
  selected_coupon_code?: string | null;
  coupon_template: string;
  starts_at?: string | null;
  ends_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ActiveStorefrontAnnouncement {
  id: string;
  name: string;
  announcement_copy: string;
  free_shipping_threshold: number;
  coupon: {
    id: string;
    code: string;
    discount_label: string;
    formatted_callout: string;
    display_title?: string | null;
    display_message?: string | null;
    terms?: string | null;
  } | null;
}

export interface CouponOption {
  id: string;
  code: string;
  discount_label: string;
  discount_type: "percentage" | "fixed" | "free_shipping";
  discount_value: number;
  display_title?: string | null;
  status: "active" | "scheduled" | "expired" | "inactive" | "depleted";
  status_reason: string;
  is_eligible_now: boolean;
  show_on_storefront: boolean;
  raw: StorefrontCoupon;
}

export const DEFAULT_ANNOUNCEMENT_BAR: AnnouncementBarConfig = {
  id: "default-announcement",
  name: "Storewide Free Shipping & Launch Promotion",
  is_enabled: true,
  status: "published",
  priority: 0,
  free_shipping_threshold: 999,
  announcement_copy: "Free shipping on orders above ₹{threshold} 🌿 Pure, Plant-Powered Ayurvedic Superfoods",
  coupon_link_mode: "automatic",
  coupon_template: "Use code {code} for {discount}",
  starts_at: null,
  ends_at: null,
};

/**
 * Validates start and end dates for announcements: end must be strictly after start.
 */
export function validateAnnouncementSchedule(
  startsAt?: string | null,
  endsAt?: string | null
): { valid: boolean; error?: string } {
  if (!startsAt || !endsAt) {
    return { valid: true };
  }

  const startMs = new Date(startsAt).getTime();
  const endMs = new Date(endsAt).getTime();

  if (isNaN(startMs)) {
    return { valid: false, error: "Invalid schedule start date" };
  }
  if (isNaN(endMs)) {
    return { valid: false, error: "Invalid schedule end date" };
  }
  if (endMs <= startMs) {
    return { valid: false, error: "Schedule end date & time must be after the start date & time" };
  }

  return { valid: true };
}

/**
 * Evaluates whether an announcement's schedule is active at a given moment.
 */
export function isAnnouncementScheduledAndActive(
  announcement: Pick<AnnouncementBarConfig, "is_enabled" | "status" | "starts_at" | "ends_at">,
  now: Date = new Date()
): boolean {
  if (!announcement.is_enabled) return false;
  if (announcement.status !== "published") return false;

  const nowMs = now.getTime();
  if (announcement.starts_at) {
    const startMs = new Date(announcement.starts_at).getTime();
    if (isNaN(startMs) || nowMs < startMs) return false;
  }
  if (announcement.ends_at) {
    const endMs = new Date(announcement.ends_at).getTime();
    if (isNaN(endMs) || nowMs >= endMs) return false;
  }

  return true;
}

/**
 * Evaluates coupon eligibility and returns detailed status information.
 */
export function getCouponEligibilityState(
  coupon: StorefrontCoupon & { is_active?: boolean; max_uses?: number | null; used_count?: number | null; show_on_storefront?: boolean },
  now: Date = new Date()
): { status: "active" | "scheduled" | "expired" | "inactive" | "depleted"; reason: string; eligible: boolean } {
  if (coupon.is_active === false) {
    return { status: "inactive", reason: "Coupon is deactivated in CMS", eligible: false };
  }

  if (coupon.show_on_storefront === false) {
    return { status: "inactive", reason: "Coupon is marked private (not shown on storefront)", eligible: false };
  }

  if (coupon.max_uses != null && (coupon.used_count || 0) >= coupon.max_uses) {
    return { status: "depleted", reason: "Maximum usage limit reached", eligible: false };
  }

  const nowMs = now.getTime();

  // Check validity schedule
  if (coupon.valid_from) {
    const fromMs = new Date(coupon.valid_from).getTime();
    if (!isNaN(fromMs) && nowMs < fromMs) {
      return { status: "scheduled", reason: `Valid from ${new Date(coupon.valid_from).toLocaleDateString()}`, eligible: false };
    }
  }

  if (coupon.valid_to) {
    const toMs = new Date(coupon.valid_to).getTime();
    if (!isNaN(toMs) && nowMs >= toMs) {
      return { status: "expired", reason: `Expired on ${new Date(coupon.valid_to).toLocaleDateString()}`, eligible: false };
    }
  }

  // Check storefront display schedule
  if (coupon.display_from) {
    const dispFromMs = new Date(coupon.display_from).getTime();
    if (!isNaN(dispFromMs) && nowMs < dispFromMs) {
      return { status: "scheduled", reason: `Display scheduled from ${new Date(coupon.display_from).toLocaleDateString()}`, eligible: false };
    }
  }

  if (coupon.display_to) {
    const dispToMs = new Date(coupon.display_to).getTime();
    if (!isNaN(dispToMs) && nowMs >= dispToMs) {
      return { status: "expired", reason: `Display ended on ${new Date(coupon.display_to).toLocaleDateString()}`, eligible: false };
    }
  }

  return { status: "active", reason: "Active and eligible for promotion", eligible: true };
}

/**
 * Calculates priority score for coupons in automatic selection mode.
 * Gives preference to site-wide promotions, higher discount amounts, and scheduled campaigns.
 */
export function getCouponPriorityScore(coupon: StorefrontCoupon): number {
  let score = 0;

  // Site-wide coupons get top priority for the global top bar
  if (!coupon.applicable_to || coupon.applicable_to === "all") {
    score += 1000;
  }

  // Value calculation
  if (coupon.discount_type === "percentage") {
    score += (coupon.discount_value || 0) * 10;
    if (coupon.max_discount && coupon.max_discount > 0) {
      score += Math.min(coupon.max_discount / 10, 50);
    }
  } else if (coupon.discount_type === "fixed") {
    score += (coupon.discount_value || 0);
  } else if (coupon.discount_type === "free_shipping") {
    score += 150;
  }

  return score;
}

/**
 * Selects the best eligible public coupon according to priority score.
 */
export function selectBestAutomaticCoupon(
  publicCoupons: StorefrontCoupon[],
  now: Date = new Date()
): StorefrontCoupon | null {
  const eligible = publicCoupons.filter((c) => {
    const state = getCouponEligibilityState(c, now);
    return state.eligible;
  });

  if (eligible.length === 0) return null;

  // Sort descending by priority score
  eligible.sort((a, b) => getCouponPriorityScore(b) - getCouponPriorityScore(a));
  return eligible[0];
}

/**
 * Interpolates variables in announcement text (e.g. {threshold}).
 */
export function formatAnnouncementText(
  text: string,
  vars: { threshold?: number | string } = {}
): string {
  const thresholdVal = vars.threshold != null ? String(vars.threshold) : "999";
  return text.replace(/\{threshold\}/g, thresholdVal);
}

/**
 * Interpolates coupon variables in coupon callout templates (e.g. {code}, {discount}, {title}, {terms}, {threshold}).
 */
export function formatCouponCallout(
  template: string,
  coupon: StorefrontCoupon,
  vars: { threshold?: number | string } = {}
): string {
  const discountLabel = formatDiscountLabel(coupon);
  const termsText = formatCouponTerms(coupon);
  const thresholdVal = vars.threshold != null ? String(vars.threshold) : "999";

  return template
    .replace(/\{code\}/g, coupon.code)
    .replace(/\{discount\}/g, discountLabel)
    .replace(/\{title\}/g, coupon.display_title || "")
    .replace(/\{terms\}/g, termsText)
    .replace(/\{threshold\}/g, thresholdVal)
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Core resolver for determining the active storefront announcement and linked coupon.
 */
export function getActiveAnnouncement(
  announcements: AnnouncementBarConfig[],
  publicCoupons: StorefrontCoupon[],
  now: Date = new Date()
): ActiveStorefrontAnnouncement | null {
  if (!announcements || announcements.length === 0) return null;

  // Filter to enabled, published, and currently scheduled announcements
  const activeList = announcements.filter((a) => isAnnouncementScheduledAndActive(a, now));
  if (activeList.length === 0) return null;

  // Sort by priority descending (higher priority first), then by updated_at descending
  activeList.sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0;
    const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0;
    return bTime - aTime;
  });

  const selectedAnnouncement = activeList[0];

  // Resolve coupon
  let linkedCoupon: StorefrontCoupon | null = null;

  if (selectedAnnouncement.coupon_link_mode === "manual") {
    if (selectedAnnouncement.selected_coupon_id || selectedAnnouncement.selected_coupon_code) {
      const found = publicCoupons.find(
        (c) =>
          c.id === selectedAnnouncement.selected_coupon_id ||
          (selectedAnnouncement.selected_coupon_code &&
            c.code.toUpperCase() === selectedAnnouncement.selected_coupon_code.toUpperCase())
      );

      if (found) {
        const state = getCouponEligibilityState(found, now);
        if (state.eligible) {
          linkedCoupon = found;
        }
      }
    }
  } else if (selectedAnnouncement.coupon_link_mode === "automatic") {
    linkedCoupon = selectBestAutomaticCoupon(publicCoupons, now);
  }

  // Format announcement copy
  const interpolatedCopy = formatAnnouncementText(selectedAnnouncement.announcement_copy, {
    threshold: selectedAnnouncement.free_shipping_threshold,
  });

  let couponPayload = null;
  if (linkedCoupon) {
    const discountLabel = formatDiscountLabel(linkedCoupon);
    const callout = formatCouponCallout(
      selectedAnnouncement.coupon_template || "Use code {code} for {discount}",
      linkedCoupon,
      { threshold: selectedAnnouncement.free_shipping_threshold }
    );
    const terms = formatCouponTerms(linkedCoupon);

    couponPayload = {
      id: linkedCoupon.id,
      code: linkedCoupon.code,
      discount_label: discountLabel,
      formatted_callout: callout,
      display_title: linkedCoupon.display_title || null,
      display_message: linkedCoupon.display_message || null,
      terms: terms || null,
    };
  }

  return {
    id: selectedAnnouncement.id,
    name: selectedAnnouncement.name,
    announcement_copy: interpolatedCopy,
    free_shipping_threshold: selectedAnnouncement.free_shipping_threshold,
    coupon: couponPayload,
  };
}

// ---------------------------------------------------------------------------
// Supabase Data Access with Seamless Site Settings Fallback
// ---------------------------------------------------------------------------

const SITE_SETTINGS_KEY = "announcement_bars";
const SHIPPING_KEY = "free_shipping_threshold";

/**
 * Fetch free shipping threshold from site_settings or fallback to 999
 */
export async function fetchFreeShippingThreshold(): Promise<number> {
  try {
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", SHIPPING_KEY)
      .maybeSingle();

    if (data?.value) {
      const parsed = parseFloat(data.value);
      if (!isNaN(parsed) && parsed >= 0) return parsed;
    }
  } catch {
    // fallback default
  }
  return 999;
}

/**
 * Fetch all announcements for CMS management
 */
export async function fetchAllAnnouncementsForCms(): Promise<AnnouncementBarConfig[]> {
  // 1. Try announcements table first
  try {
    const { data, error } = await supabase
      .from("announcements" as any)
      .select("*")
      .order("priority", { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data as AnnouncementBarConfig[];
    }
  } catch {
    // Fall back to site_settings
  }

  // 2. Fall back to site_settings
  try {
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", SITE_SETTINGS_KEY)
      .maybeSingle();

    if (data?.value) {
      const parsed = JSON.parse(data.value);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as AnnouncementBarConfig[];
      }
    }
  } catch {
    // Fallback
  }

  // 3. Return default announcement config if none exists yet
  const threshold = await fetchFreeShippingThreshold();
  return [{ ...DEFAULT_ANNOUNCEMENT_BAR, free_shipping_threshold: threshold }];
}

/**
 * Fetch the single active announcement for storefront display.
 */
export async function fetchActiveStorefrontAnnouncement(): Promise<ActiveStorefrontAnnouncement | null> {
  const [announcements, publicCoupons] = await Promise.all([
    fetchAllAnnouncementsForCms(),
    fetchStorefrontPromotions(),
  ]);

  return getActiveAnnouncement(announcements, publicCoupons);
}

/**
 * Fetch eligible public coupons for CMS dropdown selection.
 */
export async function fetchPublicCouponsForCms(): Promise<CouponOption[]> {
  try {
    // Query coupons marked show_on_storefront
    const { data, error } = await supabase
      .from("coupons")
      .select("*")
      .eq("show_on_storefront", true)
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data)) {
      const now = new Date();
      return data.map((coupon: any) => {
        const state = getCouponEligibilityState(coupon, now);
        return {
          id: coupon.id,
          code: coupon.code,
          discount_label: formatDiscountLabel(coupon),
          discount_type: coupon.discount_type,
          discount_value: coupon.discount_value,
          display_title: coupon.display_title || null,
          status: state.status,
          status_reason: state.reason,
          is_eligible_now: state.eligible,
          show_on_storefront: coupon.show_on_storefront === true,
          raw: coupon as StorefrontCoupon,
        };
      });
    }
  } catch (err) {
    console.error("Error fetching public coupons for CMS:", err);
  }

  // Fallback to fetchStorefrontPromotions
  const storefrontOffers = await fetchStorefrontPromotions();
  const now = new Date();
  return storefrontOffers.map((offer) => {
    const state = getCouponEligibilityState(offer, now);
    return {
      id: offer.id,
      code: offer.code,
      discount_label: formatDiscountLabel(offer),
      discount_type: offer.discount_type,
      discount_value: offer.discount_value,
      display_title: offer.display_title || null,
      status: state.status,
      status_reason: state.reason,
      is_eligible_now: state.eligible,
      show_on_storefront: true,
      raw: offer,
    };
  });
}

/**
 * Save announcement configuration from CMS.
 */
export async function saveAnnouncementInCms(
  announcement: AnnouncementBarConfig
): Promise<{ success: boolean; data?: AnnouncementBarConfig; error?: string }> {
  // Validate schedule
  const scheduleValidation = validateAnnouncementSchedule(announcement.starts_at, announcement.ends_at);
  if (!scheduleValidation.valid) {
    return { success: false, error: scheduleValidation.error };
  }

  const updated: AnnouncementBarConfig = {
    ...announcement,
    id: announcement.id || `announcement-${Date.now()}`,
    updated_at: new Date().toISOString(),
    created_at: announcement.created_at || new Date().toISOString(),
  };

  // 1. Fetch current list from CMS store
  const existingList = await fetchAllAnnouncementsForCms();
  const idx = existingList.findIndex((a) => a.id === updated.id);
  let newList: AnnouncementBarConfig[];
  if (idx >= 0) {
    newList = [...existingList];
    newList[idx] = updated;
  } else {
    newList = [updated, ...existingList];
  }

  // 2. Persist to site_settings (ensuring zero-downtime and local persistence)
  try {
    await supabase.from("site_settings").upsert(
      {
        key: SITE_SETTINGS_KEY,
        value: JSON.stringify(newList),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

    // Keep free shipping threshold synced if provided
    if (updated.free_shipping_threshold != null) {
      await supabase.from("site_settings").upsert(
        {
          key: SHIPPING_KEY,
          value: String(updated.free_shipping_threshold),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );
    }
  } catch (err: any) {
    console.error("Failed saving to site_settings:", err);
  }

  // 3. If announcements table is available in DB, also persist there
  try {
    const payload = {
      id: updated.id.startsWith("announcement-") ? undefined : updated.id,
      name: updated.name,
      is_enabled: updated.is_enabled,
      status: updated.status,
      priority: updated.priority,
      free_shipping_threshold: updated.free_shipping_threshold,
      announcement_copy: updated.announcement_copy,
      coupon_link_mode: updated.coupon_link_mode,
      selected_coupon_id: updated.selected_coupon_id || null,
      coupon_template: updated.coupon_template,
      starts_at: updated.starts_at || null,
      ends_at: updated.ends_at || null,
      updated_at: updated.updated_at,
    };

    const { data: dbData, error: dbError } = await supabase
      .from("announcements" as any)
      .upsert(payload)
      .select()
      .maybeSingle();

    if (!dbError && dbData) {
      return { success: true, data: dbData as AnnouncementBarConfig };
    }
  } catch {
    // Ignore if announcements table does not exist
  }

  return { success: true, data: updated };
}

/**
 * Delete an announcement from CMS.
 */
export async function deleteAnnouncementInCms(id: string): Promise<{ success: boolean; error?: string }> {
  // 1. Remove from site_settings list
  const existingList = await fetchAllAnnouncementsForCms();
  const filtered = existingList.filter((a) => a.id !== id);

  try {
    await supabase.from("site_settings").upsert(
      {
        key: SITE_SETTINGS_KEY,
        value: JSON.stringify(filtered),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
  } catch (err: any) {
    console.error("Failed deleting from site_settings:", err);
  }

  // 2. Remove from announcements table if present
  try {
    await supabase.from("announcements" as any).delete().eq("id", id);
  } catch {
    // Ignore
  }

  return { success: true };
}
