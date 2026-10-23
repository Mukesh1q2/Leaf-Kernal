-- ==============================================================================
-- Migration: Master-Admin Only Feature Controls Table, RLS & Safe Functions
-- Strictly restricts feature management to Master Admins (is_master_admin).
-- Fails safely; allows storefront to read only public storefront flags.
-- ==============================================================================

-- 1. Create public.feature_flags table
CREATE TABLE IF NOT EXISTS public.feature_flags (
  key text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL, -- 'analytics', 'feeds', 'discovery', 'storefront', 'integrations'
  is_enabled boolean NOT NULL DEFAULT false,
  is_configured boolean NOT NULL DEFAULT true,
  is_public boolean NOT NULL DEFAULT false,
  missing_dependency text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by_email text
);

-- 2. Enable RLS
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Master Admins can SELECT all flags (including internal admin flags & unconfigured integrations)
DROP POLICY IF EXISTS "Master admins can view all feature flags" ON public.feature_flags;
CREATE POLICY "Master admins can view all feature flags"
ON public.feature_flags FOR SELECT
TO authenticated
USING (public.is_master_admin(auth.uid()));

-- Non-master users / anon can ONLY view public storefront flags (discovery, storefront)
DROP POLICY IF EXISTS "Public can view public feature flags" ON public.feature_flags;
CREATE POLICY "Public can view public feature flags"
ON public.feature_flags FOR SELECT
TO anon, authenticated
USING (is_public = true);

-- ONLY Master Admins can insert, update, or delete
DROP POLICY IF EXISTS "Master admins can insert feature flags" ON public.feature_flags;
CREATE POLICY "Master admins can insert feature flags"
ON public.feature_flags FOR INSERT
TO authenticated
WITH CHECK (public.is_master_admin(auth.uid()));

DROP POLICY IF EXISTS "Master admins can update feature flags" ON public.feature_flags;
CREATE POLICY "Master admins can update feature flags"
ON public.feature_flags FOR UPDATE
TO authenticated
USING (public.is_master_admin(auth.uid()))
WITH CHECK (public.is_master_admin(auth.uid()));

DROP POLICY IF EXISTS "Master admins can delete feature flags" ON public.feature_flags;
CREATE POLICY "Master admins can delete feature flags"
ON public.feature_flags FOR DELETE
TO authenticated
USING (public.is_master_admin(auth.uid()));

-- 4. Secure RPC to update feature flag
CREATE OR REPLACE FUNCTION public.update_feature_flag(
  p_key text,
  p_enabled boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flag RECORD;
  v_user_email text;
BEGIN
  -- Strict master admin check
  IF NOT public.is_master_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Master Administrator privileges are required to modify feature controls.';
  END IF;

  SELECT * INTO v_flag FROM public.feature_flags WHERE key = p_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Feature flag % not found', p_key;
  END IF;

  -- Block enabling unconfigured features
  IF NOT v_flag.is_configured AND p_enabled THEN
    RAISE EXCEPTION 'Cannot enable unconfigured feature "%": %', v_flag.name, COALESCE(v_flag.missing_dependency, 'Missing integration requirements');
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();

  UPDATE public.feature_flags
  SET 
    is_enabled = p_enabled,
    updated_at = now(),
    updated_by = auth.uid(),
    updated_by_email = COALESCE(v_user_email, 'master_admin')
  WHERE key = p_key;

  RETURN jsonb_build_object(
    'key', p_key,
    'is_enabled', p_enabled,
    'updated_at', now(),
    'updated_by_email', COALESCE(v_user_email, 'master_admin')
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_feature_flag(text, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.update_feature_flag(text, boolean) TO authenticated;

-- 5. Seed Initial Flags
INSERT INTO public.feature_flags (
  key, name, description, category, is_enabled, is_configured, is_public, missing_dependency, updated_by_email
) VALUES
  (
    'admin_analytics',
    'Admin Analytics & Reports',
    'Comprehensive sales, financials, orders, and product performance reporting with Asia/Kolkata timezone support.',
    'analytics',
    true,
    true,
    false,
    NULL,
    'system'
  ),
  (
    'csv_downloads',
    'CSV Report Downloads',
    'Export financial summaries and product performance metrics to RFC-4180 CSV files with formula injection protection (CWE-1236).',
    'analytics',
    true,
    true,
    false,
    NULL,
    'system'
  ),
  (
    'gmc_feed',
    'Google Merchant Center Feed',
    'RSS 2.0 XML product feed with Google namespace (<g:...>) for catalog synchronization and shopping discovery.',
    'feeds',
    true,
    true,
    false,
    NULL,
    'system'
  ),
  (
    'meta_feed',
    'Meta Catalog Feed',
    'CSV product feed formatted for Meta Business Catalog manager synchronizations.',
    'feeds',
    true,
    true,
    false,
    NULL,
    'system'
  ),
  (
    'product_structured_data',
    'Product Structured Data & Discovery',
    'Schema.org/Product JSON-LD rich snippets on individual product detail pages with brand, SKU, and availability tags.',
    'discovery',
    true,
    true,
    true,
    NULL,
    'system'
  ),
  (
    'botanical_recommendations',
    'Botanical Product Recommendations',
    'Curated, non-medical botanical synergy pairings displayed on product detail pages with explainable rationale tags.',
    'storefront',
    true,
    true,
    true,
    NULL,
    'system'
  ),
  (
    'commerce_events',
    'First-Party Commerce Analytics',
    'Standard first-party e-commerce DOM event tracking (view_item, begin_checkout, purchase) respecting user consent.',
    'analytics',
    true,
    true,
    true,
    NULL,
    'system'
  ),
  (
    'delhivery_tracking',
    'Automated Delhivery Tracking',
    'Real-time automated tracking checkpoint synchronization, NDR management, and webhook integration with Delhivery logistics API.',
    'integrations',
    false,
    false,
    false,
    'Missing DELHIVERY_API_TOKEN environment variable and automated webhook receiver endpoint.',
    'system'
  ),
  (
    'razorpay_refunds',
    'Razorpay Refund Webhooks',
    'Automated payment refund ingestion and financial reconciliation ledger via Razorpay payment.refunded webhook events.',
    'integrations',
    false,
    false,
    false,
    'Missing Razorpay payment.refunded webhook handler, HMAC signature verification, and refund ledger table.',
    'system'
  )
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_configured = EXCLUDED.is_configured,
  is_public = EXCLUDED.is_public,
  missing_dependency = EXCLUDED.missing_dependency;
