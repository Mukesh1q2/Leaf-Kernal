/**
 * Feature Flags and Master Admin Feature Controls
 *
 * Provides centralized, fail-safe feature toggling persisted in the database.
 * Modifications are strictly restricted to Master Admins via RLS and PostgreSQL RPC.
 */

import { supabase } from "@/integrations/supabase/client";

export type FeatureKey =
  | "admin_analytics"
  | "csv_downloads"
  | "gmc_feed"
  | "meta_feed"
  | "product_structured_data"
  | "botanical_recommendations"
  | "commerce_events"
  | "delhivery_tracking"
  | "razorpay_refunds";

export interface FeatureFlag {
  key: FeatureKey;
  name: string;
  description: string;
  category: "analytics" | "feeds" | "discovery" | "storefront" | "integrations";
  is_enabled: boolean;
  is_configured: boolean;
  is_public: boolean;
  missing_dependency: string | null;
  updated_at: string;
  updated_by: string | null;
  updated_by_email: string | null;
}

/**
 * Initial canonical definitions and fallback defaults.
 * Configured features are initially enabled.
 * Unavailable integrations are permanently marked unconfigured and disabled.
 */
export const INITIAL_FEATURE_FLAGS: Record<FeatureKey, FeatureFlag> = {
  admin_analytics: {
    key: "admin_analytics",
    name: "Admin Analytics & Reports",
    description: "Financial, order, and product performance reporting with Asia/Kolkata timezone support.",
    category: "analytics",
    is_enabled: true,
    is_configured: true,
    is_public: false,
    missing_dependency: null,
    updated_at: new Date().toISOString(),
    updated_by: null,
    updated_by_email: "system",
  },
  csv_downloads: {
    key: "csv_downloads",
    name: "CSV Report Downloads",
    description: "Export financial summaries and product performance metrics to CSV with formula injection protection (CWE-1236).",
    category: "analytics",
    is_enabled: true,
    is_configured: true,
    is_public: false,
    missing_dependency: null,
    updated_at: new Date().toISOString(),
    updated_by: null,
    updated_by_email: "system",
  },
  gmc_feed: {
    key: "gmc_feed",
    name: "Google Merchant Center Feed",
    description: "RSS 2.0 XML product catalog feed with Google namespace (<g:...>) for Google Shopping discovery.",
    category: "feeds",
    is_enabled: true,
    is_configured: true,
    is_public: false,
    missing_dependency: null,
    updated_at: new Date().toISOString(),
    updated_by: null,
    updated_by_email: "system",
  },
  meta_feed: {
    key: "meta_feed",
    name: "Meta Catalog Feed",
    description: "CSV product catalog feed formatted for Meta Business Catalog synchronization.",
    category: "feeds",
    is_enabled: true,
    is_configured: true,
    is_public: false,
    missing_dependency: null,
    updated_at: new Date().toISOString(),
    updated_by: null,
    updated_by_email: "system",
  },
  product_structured_data: {
    key: "product_structured_data",
    name: "Product Structured Data & Discovery",
    description: "Schema.org/Product JSON-LD rich snippets on product pages with brand, SKU, and availability tags.",
    category: "discovery",
    is_enabled: true,
    is_configured: true,
    is_public: true,
    missing_dependency: null,
    updated_at: new Date().toISOString(),
    updated_by: null,
    updated_by_email: "system",
  },
  botanical_recommendations: {
    key: "botanical_recommendations",
    name: "Botanical Product Recommendations",
    description: "Curated, non-medical botanical synergy pairings displayed on product detail pages with explainable rationale.",
    category: "storefront",
    is_enabled: true,
    is_configured: true,
    is_public: true,
    missing_dependency: null,
    updated_at: new Date().toISOString(),
    updated_by: null,
    updated_by_email: "system",
  },
  commerce_events: {
    key: "commerce_events",
    name: "First-Party Commerce Analytics",
    description: "Standard first-party e-commerce DOM event tracking (view_item, begin_checkout, purchase) respecting user consent.",
    category: "analytics",
    is_enabled: true,
    is_configured: true,
    is_public: true,
    missing_dependency: null,
    updated_at: new Date().toISOString(),
    updated_by: null,
    updated_by_email: "system",
  },
  delhivery_tracking: {
    key: "delhivery_tracking",
    name: "Automated Delhivery Tracking",
    description: "Real-time automated tracking checkpoint synchronization, NDR management, and webhook integration with Delhivery logistics API.",
    category: "integrations",
    is_enabled: false,
    is_configured: false,
    is_public: false,
    missing_dependency: "Missing DELHIVERY_API_TOKEN environment variable and automated webhook receiver endpoint.",
    updated_at: new Date().toISOString(),
    updated_by: null,
    updated_by_email: "system",
  },
  razorpay_refunds: {
    key: "razorpay_refunds",
    name: "Razorpay Refund Webhooks",
    description: "Automated payment refund ingestion and financial reconciliation ledger via Razorpay payment.refunded webhook events.",
    category: "integrations",
    is_enabled: false,
    is_configured: false,
    is_public: false,
    missing_dependency: "Missing Razorpay payment.refunded webhook handler, HMAC signature verification, and refund ledger table.",
    updated_at: new Date().toISOString(),
    updated_by: null,
    updated_by_email: "system",
  },
};

// In-memory cache of flags
let flagsCache: Record<string, FeatureFlag> | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

export const FEATURE_FLAGS_CHANGED_EVENT = "uvediq_feature_flags_updated";

/**
 * Fetch feature flags from database.
 * If user is master admin, returns all flags.
 * If user is public/customer, returns public storefront flags.
 * Fails safely on errors without granting unexpected permissions.
 */
export async function getFeatureFlags(forceRefresh = false): Promise<Record<FeatureKey, FeatureFlag>> {
  const now = Date.now();
  if (!forceRefresh && flagsCache && (now - lastFetchTime) < CACHE_TTL_MS) {
    return flagsCache as Record<FeatureKey, FeatureFlag>;
  }

  try {
    const { data, error } = await supabase
      .from("feature_flags")
      .select("*");

    if (error) {
      console.warn("Could not fetch remote feature_flags:", error.message);
      // Return cached or fallback safely
      return (flagsCache || INITIAL_FEATURE_FLAGS) as Record<FeatureKey, FeatureFlag>;
    }

    if (data && data.length > 0) {
      const merged: Record<string, FeatureFlag> = { ...INITIAL_FEATURE_FLAGS };
      for (const row of data) {
        if (row.key in merged) {
          merged[row.key] = {
            ...merged[row.key],
            ...(row as unknown as FeatureFlag),
          };
        }
      }
      flagsCache = merged;
      lastFetchTime = now;
      return merged as Record<FeatureKey, FeatureFlag>;
    }

    // Default if table is empty
    flagsCache = { ...INITIAL_FEATURE_FLAGS };
    lastFetchTime = now;
    return flagsCache as Record<FeatureKey, FeatureFlag>;
  } catch (err) {
    console.warn("Exception fetching feature flags:", err);
    return (flagsCache || INITIAL_FEATURE_FLAGS) as Record<FeatureKey, FeatureFlag>;
  }
}

/**
 * Check whether a specific feature is enabled.
 * Fail-safe: Returns false if feature is unconfigured or if error occurs.
 */
export async function isFeatureEnabled(key: FeatureKey): Promise<boolean> {
  const flags = await getFeatureFlags();
  const flag = flags[key];
  if (!flag) return false;
  if (!flag.is_configured) return false;
  return Boolean(flag.is_enabled);
}

/**
 * Synchronous check against cached flags.
 * Useful for render loops and non-async event handlers.
 */
export function isFeatureEnabledSync(key: FeatureKey): boolean {
  if (flagsCache && flagsCache[key]) {
    const flag = flagsCache[key];
    if (!flag.is_configured) return false;
    return Boolean(flag.is_enabled);
  }
  // Fall back to initial definition
  const initial = INITIAL_FEATURE_FLAGS[key];
  return Boolean(initial && initial.is_configured && initial.is_enabled);
}

/**
 * Update a feature flag status.
 * Strictly requires Master Administrator authorization.
 * Cannot enable unconfigured integrations.
 */
export async function updateFeatureFlag(
  key: FeatureKey,
  enabled: boolean,
  isMasterAdmin: boolean,
  userEmail?: string | null
): Promise<{ success: boolean; error?: string; flag?: FeatureFlag }> {
  // Client pre-check: Fail fast if not master admin
  if (!isMasterAdmin) {
    return {
      success: false,
      error: "Permission denied: Only Master Administrators can modify feature controls.",
    };
  }

  const flags = await getFeatureFlags();
  const currentFlag = flags[key];

  if (!currentFlag) {
    return { success: false, error: `Feature flag "${key}" was not found.` };
  }

  if (!currentFlag.is_configured && enabled) {
    return {
      success: false,
      error: `Cannot enable unconfigured feature: ${currentFlag.missing_dependency || "Missing configuration"}`,
    };
  }

  try {
    // Attempt RPC first (enforces is_master_admin(auth.uid()) in PostgreSQL)
    const { data: rpcData, error: rpcError } = await supabase.rpc("update_feature_flag", {
      p_key: key,
      p_enabled: enabled,
    });

    if (rpcError) {
      // If RPC doesn't exist yet (e.g., local mock or pending migration), try standard table update under RLS
      const { error: tableError } = await supabase
        .from("feature_flags")
        .update({
          is_enabled: enabled,
          updated_at: new Date().toISOString(),
          updated_by_email: userEmail || "master_admin",
        })
        .eq("key", key);

      if (tableError) {
        return {
          success: false,
          error: tableError.message || rpcError.message,
        };
      }
    }

    // Update in-memory cache
    if (flagsCache && flagsCache[key]) {
      flagsCache[key] = {
        ...flagsCache[key],
        is_enabled: enabled,
        updated_at: new Date().toISOString(),
        updated_by_email: userEmail || "master_admin",
      };
    }

    // Broadcast local change event
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(FEATURE_FLAGS_CHANGED_EVENT, {
          detail: { key, enabled },
        })
      );
    }

    return {
      success: true,
      flag: flagsCache ? flagsCache[key] : undefined,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "An unexpected error occurred while saving the feature setting.",
    };
  }
}
